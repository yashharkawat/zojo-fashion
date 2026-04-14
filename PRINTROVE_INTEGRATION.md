# Printrove Integration — Zojo Fashion

End-to-end print-on-demand fulfillment through Printrove's API.

> ⚠️ **API contract note:** Printrove's public API shapes evolve. The TypeScript
> types in `apps/api/src/types/printrove.ts` reflect a reasonable model based on
> standard POD API patterns; **cross-check against the latest Printrove docs
> before go-live** and tweak the adapter in `lib/printrove.ts` accordingly. The
> adapter pattern keeps the rest of the codebase insulated from shape changes.

---

## Contents

1. [End-to-end flow](#1-end-to-end-flow)
2. [Status mapping](#2-status-mapping)
3. [TypeScript types](#3-typescript-types)
4. [Printrove client (`PrintroveClient`)](#4-printrove-client-printroveclient)
5. [Auto order creation after payment](#5-auto-order-creation-after-payment)
6. [Webhook handler](#6-webhook-handler)
7. [Polling fallback (stuck orders)](#7-polling-fallback-stuck-orders)
8. [Customer notifications](#8-customer-notifications)
9. [Retry & failed-order recovery](#9-retry--failed-order-recovery)
10. [Admin endpoints](#10-admin-endpoints)
11. [Testing checklist](#11-testing-checklist)

---

## 1. End-to-end flow

```
Customer → Razorpay                 Zojo API                    Printrove
───────────────────                 ────────                    ─────────

[Payment]
  ├─ handler: razorpay_signature
  │
  ▼
  POST /payments/verify  (or webhook: payment.captured)
                         │
                         ▼
                   Order → CONFIRMED
                   Trigger: enqueueOrderPush(orderId)
                         │
                         ▼
           [PrintroveClient.createOrder()]
                         │
                         ├────── POST /orders ──────────────▶ create
                         │
                         ◀── { order_id, status: 'pending' }
                         │
                   Order → PRINTING
                   printroveOrderId saved
                   printroveSyncStatus = SYNCED
                         │
                         ▼
                   Send: "We've received your order" SMS+email

                         ◀── Webhook: order.in_production
                         ◀── Webhook: order.shipped  { awb, courier, url }
                   Order → SHIPPED
                   Shipment row saved
                   Send: "Your order shipped" + tracking link

                         ◀── Webhook: order.delivered
                   Order → DELIVERED
                   Send: "Delivered — review us?" (t+1 day)
```

### Guarantees

- **Each step is idempotent.** Retries and duplicate webhooks converge to the same state.
- **Webhook is source of truth** for fulfillment state. Inline push + polling are
  additional safety nets, not primary sources.
- **Failed pushes are discoverable.** `Order.printroveSyncStatus = FAILED` with
  retry counter and last error message. Admin can retry with one click.

---

## 2. Status mapping

Printrove publishes lifecycle events; we map each to our `OrderStatus` enum.

| Printrove event | Printrove status | Our OrderStatus | Our ShipmentStatus | Customer notification |
|---|---|---|---|---|
| `order.created` (response) | `pending` | `PRINTING` | — | "Order received" email + SMS |
| `order.in_production` | `in_production` | `PRINTING` | — | — |
| `order.shipped` | `shipped` | `SHIPPED` | `IN_TRANSIT` | "Shipped" with tracking link |
| `order.out_for_delivery` | `out_for_delivery` | `SHIPPED` | `OUT_FOR_DELIVERY` | "Out for delivery today" SMS |
| `order.delivered` | `delivered` | `DELIVERED` | `DELIVERED` | "Delivered" + review prompt (async t+24h) |
| `order.cancelled` | `cancelled` | `CANCELLED` | — | "Unable to fulfill" + refund initiated |
| `order.rto` (return to origin) | `rto` | `CANCELLED` | `RTO_INITIATED` | "Parcel returned — please contact us" |

**Mapping table lives in code at** `modules/printrove/printrove.webhook.service.ts::STATUS_MAP`.

---

## 3. TypeScript types

All Printrove request/response shapes live in `apps/api/src/types/printrove.ts`.
Highlights — each wrapped in branded/discriminated unions where useful:

```typescript
// Request
export interface PrintroveCreateOrderRequest {
  external_order_id: string;      // our orderNumber (idempotency on their side)
  items: Array<{ variant_id: string; quantity: number }>;
  shipping_address: PrintroveAddress;
  customer: { name: string; email: string; phone: string };
  cod?: { enabled: boolean; amount_paise?: number };
  notes?: string;
}

// Response envelopes
export type PrintroveApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

// Webhook event (discriminated by `event`)
export type PrintroveWebhookEvent =
  | { event: 'order.in_production'; order_id: string; at: string }
  | { event: 'order.shipped'; order_id: string; at: string; shipment: PrintroveShipmentInfo }
  | { event: 'order.out_for_delivery'; order_id: string; at: string }
  | { event: 'order.delivered'; order_id: string; at: string }
  | { event: 'order.cancelled'; order_id: string; at: string; reason?: string }
  | { event: 'order.rto'; order_id: string; at: string; reason?: string };
```

See the full file for every shape. The union discriminator lets the webhook
switch exhaustively (compiler catches missing cases).

---

## 4. Printrove client (`PrintroveClient`)

A single class encapsulating auth, retries, and error translation. Lives in
`apps/api/src/lib/printrove.ts`.

**Responsibilities:**
- Token header injection (`Authorization: Bearer <api key>`)
- JSON envelope parsing (`PrintroveApiResult<T>`)
- Retry policy: 3 attempts, exponential backoff (500ms, 1s, 2s), only on 5xx/network
- Signature verification for webhooks (HMAC-SHA256 over raw body)
- Narrow methods: `createOrder`, `getOrder`, `cancelOrder`, `getTracking`, `getProducts`
- All side-effectful errors wrapped in `UpstreamError` (503) so our global error
  handler formats them consistently

See §4 of the code below for the complete implementation.

---

## 5. Auto order creation after payment

Triggered from **two** entry points, both converging on `enqueuePrintrovePush(orderId)`:

1. **`/payments/verify` success** (client-side handler flow)
2. **`payment.captured` webhook** (source of truth)

Both call `payments.service::pushToPrintroveBackground()` which:

```typescript
1. Short-circuits if order.printroveOrderId already set (idempotent)
2. Loads order with items + address snapshot
3. Validates every item has printroveSku (mapping must exist)
4. Calls printroveClient.createOrder()
5. On success: Order → PRINTING, printroveOrderId saved, sync=SYNCED
6. On failure: sync=FAILED, retryCount++, lastError stored
7. Emits notification: "Order confirmed" (once per order, dedup key = orderId)
```

**MVP note:** in this phase we still call it inline from the verify/webhook
handler. Week-2 upgrade: move to BullMQ so the API responds in <100ms even under
Printrove slowness and retries are scheduled instead of inline-backed-off.

---

## 6. Webhook handler

### Endpoint
`POST /api/v1/printrove/webhook`

### Headers
- `x-printrove-signature` — HMAC-SHA256 hex of raw body, key = `PRINTROVE_WEBHOOK_SECRET`
- `x-printrove-event-id` — unique event id (used for dedupe)

### Security
- Verify signature with `timingSafeEqual`
- Only whitelisted IPs in prod (Printrove publishes ranges — check docs)
- Raw body parser (before `express.json()`)

### Idempotency
Reuses `ProcessedWebhookEvent` table: `(provider: 'PRINTROVE', eventId)` unique.
Prisma P2002 → skip silently (200 OK).

### Switch
```typescript
switch (event.event) {
  case 'order.in_production':    // status update only
  case 'order.shipped':          // + Shipment row + SMS/email
  case 'order.out_for_delivery': // + Shipment update + optional SMS
  case 'order.delivered':        // + Shipment delivered + review email (async)
  case 'order.cancelled':        // + refund initiation
  case 'order.rto':              // + admin alert
  default: logger.warn('Unhandled event');
}
```

Exhaustive — TypeScript compiler enforces every event type is handled.

---

## 7. Polling fallback (stuck orders)

Webhooks are reliable but not infallible (network drops, webhook URL changes,
deploy windows). A **nightly cron** sweeps orders stuck in `PRINTING` or `SHIPPED`
without recent status updates and polls `GET /orders/:printroveOrderId`.

```typescript
// Runs every hour via Railway cron
async function reconcileStuckOrders() {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h no update
  const stuck = await prisma.order.findMany({
    where: {
      status: { in: ['PRINTING', 'SHIPPED'] },
      printroveOrderId: { not: null },
      updatedAt: { lt: cutoff },
    },
    take: 50,
  });
  for (const order of stuck) {
    try {
      const remote = await printrove.getOrder(order.printroveOrderId!);
      await applyStatusSync(order.id, remote);
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Poll failed');
    }
  }
}
```

In MVP we ship this as a manual admin endpoint `POST /admin/orders/:id/sync`;
cron comes in week 2.

---

## 8. Customer notifications

Thin wrapper over Resend (email) + MSG91 (SMS). See `lib/notifications.ts`.

### Triggers

| Event | Email | SMS |
|---|---|---|
| Order confirmed (paid) | ✅ template: `order-confirmed` | ✅ short link to track |
| Order shipped | ✅ template: `order-shipped` with tracking button | ✅ "Your order has shipped. Track: <url>" |
| Out for delivery | — | ✅ (optional, high-value orders only) |
| Delivered | ✅ template: `order-delivered` + review CTA | — |
| Cancelled / RTO | ✅ template: `order-issue` | ✅ |
| Refund processed | ✅ | ✅ |

### Deduplication
Every notification is logged in a `notification_events` table (not yet in
schema — add in week 2). For MVP we dedupe via a unique constraint on
`(orderId, type)` to prevent duplicate "shipped" SMS when webhook replays
(even though webhook itself is idempotent, belt-and-braces for notifications).

**MVP stub:** the `notifications` lib currently logs + no-ops when keys aren't
configured. Plug in Resend + MSG91 when creds are ready.

---

## 9. Retry & failed-order recovery

### Inline retry
`PrintroveClient` retries 3× with backoff 500ms / 1s / 2s, only on:
- Network errors (`fetch` throws)
- HTTP 5xx
- HTTP 429 (rate limited)

4xx responses (validation errors from Printrove) are **not** retried — they
indicate bad data (missing mapping, invalid pincode) and need human review.

### Persisted failure state
Order row tracks:
```
printroveSyncStatus    NOT_SYNCED | SYNCED | FAILED | MANUAL_REVIEW
printroveRetryCount    int (inline attempts)
printroveLastError     string (last 500 chars)
printroveLastSyncedAt  timestamp
```

### Admin recovery
- `GET /api/v1/admin/orders?printroveSyncStatus=FAILED` — list failed pushes
- `POST /api/v1/admin/orders/:id/retry-printrove` — force re-push
- `POST /api/v1/admin/orders/:id/mark-manual-review` — flag for ops (e.g., a
  product missing mapping — ops fixes mapping, then retries)

Failed pushes emit a Sentry event so the team sees them immediately.

---

## 10. Admin endpoints

```
GET  /api/v1/admin/orders?printroveSyncStatus=FAILED   # list failed
POST /api/v1/admin/orders/:id/retry-printrove          # retry push
POST /api/v1/admin/orders/:id/sync-printrove           # poll + reconcile
POST /api/v1/admin/orders/:id/mark-manual-review       # mark for human
```

All: require `ADMIN` or `SUPER_ADMIN` role. All: log to `AuditLog`.

---

## 11. Testing checklist

### Happy path (test/sandbox Printrove account)
- [ ] Place order → pay via Razorpay test card → verify `printroveOrderId` stored within 30s
- [ ] Send test webhook `order.shipped` → verify `Order.status = SHIPPED`, `Shipment.awbNumber` set, SMS fires (log check)
- [ ] Send test webhook `order.delivered` → verify `Order.status = DELIVERED`

### Idempotency
- [ ] Replay same `order.shipped` webhook → second call is no-op (200 OK, `applied: false`)
- [ ] Call `/payments/verify` and the `payment.captured` webhook both fire → only one Printrove order created (check by external_order_id)

### Failure paths
- [ ] Disable Printrove API key → payment still confirms; order shows `printroveSyncStatus=FAILED`; admin retry works
- [ ] Simulate 500 from Printrove (mock server) → 3 retries observed in logs
- [ ] Send webhook with bad signature → 422 response, no state change
- [ ] Product without `printroveVariantId` → order creation fails fast with `VALIDATION_ERROR`, admin sees in failed list

### Customer notifications
- [ ] No duplicate emails/SMS when webhook replays
- [ ] Template variables rendered correctly (order number, tracking URL, items list)
- [ ] SMS under 160 chars for deliverability

---

## Files added/changed in this phase

### Backend
- `apps/api/src/types/printrove.ts` — complete types (new)
- `apps/api/src/lib/printrove.ts` — `PrintroveClient` class (replaces old functions)
- `apps/api/src/lib/notifications.ts` — email + SMS dispatch (new)
- `apps/api/src/modules/printrove/printrove.webhook.controller.ts` (new)
- `apps/api/src/modules/printrove/printrove.webhook.service.ts` (new)
- `apps/api/src/modules/printrove/printrove.webhook.routes.ts` (new)
- `apps/api/src/modules/admin/admin.service.ts` — `retryPrintrove`, `syncPrintrove`, `markManualReview` methods
- `apps/api/src/modules/admin/admin.routes.ts` — 3 new admin routes
- `apps/api/src/app.ts` — mount `/api/v1/printrove/webhook` with raw parser
- `apps/api/src/modules/payments/payments.service.ts` — emits "order confirmed" notification after Printrove push

### Notes
- Reuses `ProcessedWebhookEvent` table (already added for Razorpay)
- No schema changes in this phase — all sync fields were already on `Order`
