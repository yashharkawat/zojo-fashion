# Razorpay Integration — Zojo Fashion

Complete Razorpay payment integration. India-first: UPI, Cards, NetBanking, Wallets, plus **COD** (Cash on Delivery, no Razorpay).

---

## Contents

1. [Architecture](#1-architecture)
2. [Data model additions](#2-data-model-additions)
3. [Backend — payment flow](#3-backend--payment-flow)
4. [Backend — COD flow](#4-backend--cod-flow)
5. [Backend — webhook handler](#5-backend--webhook-handler)
6. [Backend — refund handler](#6-backend--refund-handler)
7. [Backend — receipts](#7-backend--receipts)
8. [Frontend — checkout component](#8-frontend--checkout-component)
9. [Error handling matrix](#9-error-handling-matrix)
10. [Testing & launch checklist](#10-testing--launch-checklist)

---

## 1. Architecture

```
 Next.js client                Express API (TS)             Razorpay
 ──────────────                ────────────────             ─────────

 [Checkout page]
      │
      │ 1. POST /payments/create { orderId, method }
      │    method ∈ { RAZORPAY | COD }
      ▼
                              ┌──── COD path ──────────────┐
                              │ Validate pincode serviceable│
                              │ Order → CONFIRMED           │
                              │ Push to Printrove async     │
                              │ Respond { method: 'COD' }   │
                              └─────────────────────────────┘
                              ┌──── Razorpay path ──────────┐
                              │ orders.create({ amount })   │──▶ create
                              │ Payment row (CREATED)       │◀── rzp_order
                              │ Respond { keyId, rzOrderId }│
                              └─────────────────────────────┘
      │
      │ 2. window.Razorpay.open(options)
      ▼
 [Razorpay modal]
      │ UPI / card / NB / wallet
      │ user pays
      ▼
      │ 3. handler({ razorpay_payment_id, razorpay_order_id, razorpay_signature })
      │
      │ 4. POST /payments/verify (handler → our API)
      ▼
                              │ HMAC SHA256 verify           │
                              │ Payment → CAPTURED           │
                              │ Order → CONFIRMED            │
                              │ Queue Printrove push         │
                              │ Respond { orderNumber }      │
      │
      │ 5. Redirect → /orders/:orderNumber/success
      ▼
 [Success page]

                              ┌──── (in parallel) ──────────┐
                              │ POST /payments/webhook      │◀── Razorpay webhook
                              │ Verify WEBHOOK signature    │    (payment.captured,
                              │ Dedupe by event.id          │     payment.failed,
                              │ Converge to same state      │     refund.processed)
                              └─────────────────────────────┘
```

**Invariant:** the webhook handler is the source of truth. If `/verify` fails or the browser dies, the webhook lands the user in the correct state. Both paths are idempotent and converge.

---

## 2. Data model additions

Two models to add to `prisma/schema.prisma` to support **idempotent webhooks** and **receipt storage**.

```prisma
// Idempotency dedupe for webhooks. Razorpay retries until 2xx;
// without this table we'd double-apply state changes.
model ProcessedWebhookEvent {
  id         String   @id @default(cuid())
  provider   String                                  // "RAZORPAY" | "PRINTROVE"
  eventId    String                                  // Razorpay's x-razorpay-event-id
  eventType  String
  payloadHash String?                                // SHA-256 of raw body for audit
  createdAt  DateTime @default(now())

  @@unique([provider, eventId])
  @@index([provider, createdAt])
}

// Payment receipts (minimal — PDF URL if generated + cached)
model Receipt {
  id            String   @id @default(cuid())
  orderId       String   @unique
  order         Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  receiptNumber String   @unique                     // ZJ-RCPT-2026-000123
  pdfUrl        String?                              // Cloudinary URL, generated on demand
  issuedAt      DateTime @default(now())

  @@index([receiptNumber])
}
```

Also add this relation field to `Order`:
```prisma
model Order {
  // ...existing fields
  receipt   Receipt?
}
```

And extend `PaymentMethod` enum to include the gateway concept separately from method:
```prisma
enum PaymentMethod {
  UPI
  CARD
  NETBANKING
  WALLET
  EMI
  COD
  OTHER
}
```
(Already in schema.)

---

## 3. Backend — payment flow

### Summary of enhancements to `payments.service.ts`

- `createPayment` now accepts `{ orderId, method: 'RAZORPAY' | 'COD' }`
- COD path short-circuits Razorpay, marks order `CONFIRMED`, creates a sentinel `Payment` row with status `CAPTURED` and `method=COD`
- Webhook handler uses `ProcessedWebhookEvent` for dedupe
- Full refund + partial refund methods

### Updated schema (`payments.schema.ts`)

```typescript
import { z } from 'zod';

export const createPaymentBodySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(['RAZORPAY', 'COD']).default('RAZORPAY'),
});

export const verifyPaymentBodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const refundPaymentBodySchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().positive().optional(), // paise; omit = full refund
  reason: z.string().max(500).optional(),
});

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentBodySchema>;
```

See `apps/api/src/modules/payments/payments.service.ts` for the full implementation (enhanced in this commit).

---

## 4. Backend — COD flow

COD has no gateway — we just validate the order and flip it to CONFIRMED. Risk: higher cancellation rate. Mitigations:

- Require phone verification at checkout (future)
- Cap COD at ₹2000 until trust score exists (stretch)
- Charge a small COD convenience fee (configurable; starts at 0)

```typescript
// in payments.service.ts (excerpt)
if (input.method === 'COD') {
  // COD eligibility: pincode serviceable + total under limit
  if (order.total > 500_000) { // ₹5000 cap
    throw new ValidationError('COD not available for orders above ₹5000');
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        razorpayOrderId: `COD_${order.orderNumber}`, // sentinel — unique
        razorpayReceipt: order.orderNumber,
        amount: order.total,
        method: 'COD',
        status: 'CAPTURED',
        capturedAt: new Date(),
      },
      update: { method: 'COD', status: 'CAPTURED', capturedAt: new Date() },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, status: 'CONFIRMED', source: 'COD', actorId: userId },
    });
    return payment;
  });

  pushToPrintroveBackground(order.id).catch(/* logged */);
  return { method: 'COD' as const, orderNumber: order.orderNumber, status: 'CONFIRMED' };
}
```

---

## 5. Backend — webhook handler

### Events handled
- `payment.captured` → mark Payment CAPTURED, Order CONFIRMED, trigger Printrove
- `payment.failed` → mark Payment FAILED (log reason)
- `refund.created` / `refund.processed` → update Refund row
- `payment.authorized` (rare, when auto-capture disabled) → log only

### Idempotency
Every webhook event has `x-razorpay-event-id`. We insert into `ProcessedWebhookEvent` in a single transaction with the state mutation; the unique constraint `[provider, eventId]` makes replays safe.

```typescript
// excerpt from payments.service.ts
async function recordProcessedEvent(eventId: string, eventType: string, rawBody: string) {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        eventId,
        eventType,
        payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
      },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false; // already processed
    }
    throw err;
  }
}
```

### Mount
The webhook route **must** use `express.raw({ type: 'application/json' })` BEFORE any `express.json()` middleware, because HMAC must be computed over the exact raw body. Already wired in `app.ts`:

```typescript
// app.ts (order matters!)
app.use('/api/v1/payments/webhook', paymentsRouter); // mounted first — uses raw()
app.use(express.json({ limit: '1mb' }));              // json parser for everything else
```

---

## 6. Backend — refund handler

### Endpoint
`POST /api/v1/payments/refund` — admin only (`ADMIN` or `SUPER_ADMIN`).

### Rules
- Only refund orders with `Payment.status === CAPTURED` and non-COD (COD refunds are manual/cash)
- Cannot exceed `order.total - order.payment.amountRefunded`
- Full refund transitions order to `REFUNDED`; partial keeps order status but updates `amountRefunded`
- Refund webhook from Razorpay confirms state; our initial write is optimistic

### Service code
```typescript
export async function refund(adminUserId: string, input: RefundPaymentBody) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (!order.payment) throw new ConflictError('No payment on this order');
  if (order.payment.status !== 'CAPTURED') throw new ConflictError('Payment not captured');
  if (order.payment.method === 'COD') {
    throw new ConflictError('COD orders must be refunded manually (cash)');
  }
  if (!order.payment.razorpayPaymentId) throw new ConflictError('Missing Razorpay payment id');

  const refundable = order.payment.amount - order.payment.amountRefunded;
  const amount = input.amount ?? refundable;
  if (amount <= 0 || amount > refundable) {
    throw new ValidationError(`Refund amount must be 1..${refundable} paise`);
  }
  const isFull = amount === refundable;

  const rzRefund = await refundPayment({
    razorpayPaymentId: order.payment.razorpayPaymentId,
    amountPaise: amount,
    notes: { orderNumber: order.orderNumber, reason: input.reason ?? 'admin_refund' },
  });

  return prisma.$transaction(async (tx) => {
    const refundRow = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: order.payment!.id,
        razorpayRefundId: rzRefund.id,
        amount,
        status: rzRefund.status === 'processed' ? 'PROCESSED' : 'PENDING',
        reason: input.reason ?? null,
        initiatedByAdminId: adminUserId,
      },
    });
    await tx.payment.update({
      where: { id: order.payment!.id },
      data: {
        amountRefunded: { increment: amount },
        status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });
    if (isFull) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: 'REFUNDED',
          source: 'ADMIN',
          actorId: adminUserId,
          meta: { refundId: rzRefund.id, amount },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: isFull ? 'ORDER_REFUND_FULL' : 'ORDER_REFUND_PARTIAL',
        entity: 'Order',
        entityId: order.id,
        diff: { amount, razorpayRefundId: rzRefund.id },
      },
    });
    return refundRow;
  });
}
```

---

## 7. Backend — receipts

For MVP: a plain HTML receipt served at `GET /api/v1/orders/:id/receipt` for the customer's own order. PDF generation (via Puppeteer or a service like DocRaptor) is week-2.

```typescript
export async function buildReceiptHtml(orderId: string, userId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order || order.userId !== userId) throw new NotFoundError('Order not found');

  const addr = order.shippingAddressSnapshot as { fullName: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  const inr = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  return `
<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${order.orderNumber}</title>
<style>body{font-family:system-ui;max-width:640px;margin:2rem auto;padding:1rem}
table{width:100%;border-collapse:collapse}td,th{padding:.5rem;border-bottom:1px solid #eee;text-align:left}
.r{text-align:right}.total{font-weight:700;font-size:1.1rem}</style></head>
<body>
  <h1>Zojo Fashion</h1>
  <p><strong>Receipt:</strong> ${order.orderNumber}<br>
  <strong>Date:</strong> ${order.placedAt.toISOString().slice(0, 10)}<br>
  <strong>Payment:</strong> ${order.payment?.method ?? '—'} ${order.payment?.razorpayPaymentId ? `(${order.payment.razorpayPaymentId})` : ''}</p>

  <h3>Ship to</h3>
  <p>${addr.fullName}<br>${addr.line1}${addr.line2 ? `, ${addr.line2}` : ''}<br>${addr.city}, ${addr.state} ${addr.pincode}</p>

  <h3>Items</h3>
  <table>
    <tr><th>Item</th><th>Variant</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr>
    ${order.items.map((i) => `
      <tr><td>${i.productTitle}</td><td>${i.variantLabel}</td>
          <td class="r">${i.quantity}</td><td class="r">${inr(i.unitPrice)}</td><td class="r">${inr(i.lineTotal)}</td></tr>
    `).join('')}
  </table>

  <table style="margin-top:1rem">
    <tr><td>Subtotal</td><td class="r">${inr(order.subtotal)}</td></tr>
    ${order.discountAmount ? `<tr><td>Discount (${order.couponCode ?? ''})</td><td class="r">− ${inr(order.discountAmount)}</td></tr>` : ''}
    <tr><td>Shipping</td><td class="r">${inr(order.shippingFee)}</td></tr>
    <tr><td>GST</td><td class="r">${inr(order.taxAmount)}</td></tr>
    <tr class="total"><td>Total</td><td class="r">${inr(order.total)}</td></tr>
  </table>

  <p style="margin-top:2rem;color:#666;font-size:.85rem">This is a system-generated receipt.
  Zojo Fashion • zojofashion.com • support@zojofashion.com${order.gstin ? `<br>GSTIN: ${order.gstin}` : ''}</p>
</body></html>`.trim();
}
```

Route:
```typescript
ordersRouter.get('/:id/receipt', asyncHandler(async (req, res) => {
  const html = await ordersService.receipt(req.auth!.userId, req.params.id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));
```

---

## 8. Frontend — checkout component

### Setup
Add Razorpay public key to Next.js env:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

### Types (`src/types/razorpay.ts`)
```typescript
export interface RazorpayOptions {
  key: string;
  amount: number;          // paise
  currency: 'INR';
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean };
  handler: (resp: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

export interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: 'payment.failed', handler: (resp: RazorpayFailure) => void): void;
}

export interface RazorpayFailure {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: { order_id?: string; payment_id?: string };
  };
}

declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}
```

### API client (`src/lib/api.ts`)
```typescript
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

interface ApiResult<T> {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export async function api<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as ApiResult<T>;
  if (!res.ok || body.error) {
    throw Object.assign(new Error(body.error?.message ?? 'Request failed'), {
      code: body.error?.code ?? 'UNKNOWN',
      status: res.status,
      details: body.error?.details,
    });
  }
  return body.data as T;
}
```

### Script loader hook (`src/hooks/useRazorpayScript.ts`)
```typescript
'use client';
import { useEffect, useState } from 'react';

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export function useRazorpayScript(): 'idle' | 'loading' | 'ready' | 'error' {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) { setState('ready'); return; }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      setState('loading');
      existing.addEventListener('load', () => setState('ready'));
      existing.addEventListener('error', () => setState('error'));
      return;
    }
    setState('loading');
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => setState('ready');
    s.onerror = () => setState('error');
    document.body.appendChild(s);
  }, []);

  return state;
}
```

### Checkout component (`src/components/checkout/CheckoutButton.tsx`)
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRazorpayScript } from '@/hooks/useRazorpayScript';
import type { RazorpayHandlerResponse, RazorpayFailure } from '@/types/razorpay';

type Method = 'RAZORPAY' | 'COD';

interface CreatePaymentResponse {
  method: 'RAZORPAY' | 'COD';
  razorpayOrderId?: string;
  amount?: number;
  currency?: 'INR';
  keyId?: string;
  orderNumber: string;
  prefill?: { name: string; email: string; contact: string };
  status?: string;
}

interface VerifyResponse {
  orderNumber: string;
  status: string;
  alreadyCaptured: boolean;
}

export function CheckoutButton({
  orderId,
  accessToken,
  onBeforePay,
}: {
  orderId: string;
  accessToken: string;
  onBeforePay?: () => void;
}) {
  const router = useRouter();
  const scriptState = useRazorpayScript();

  const [method, setMethod] = useState<Method>('RAZORPAY');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setSubmitting(true);
    onBeforePay?.();
    try {
      const createRes = await api<CreatePaymentResponse>('/payments/create', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({ orderId, method }),
      });

      // COD path — server already confirmed
      if (createRes.method === 'COD') {
        router.push(`/orders/${createRes.orderNumber}/success?method=cod`);
        return;
      }

      if (scriptState !== 'ready') {
        throw new Error('Payment script not loaded. Please refresh.');
      }
      if (!createRes.keyId || !createRes.razorpayOrderId || !createRes.amount) {
        throw new Error('Invalid payment init response');
      }

      const rz = new window.Razorpay({
        key: createRes.keyId,
        amount: createRes.amount,
        currency: 'INR',
        name: 'Zojo Fashion',
        description: `Order ${createRes.orderNumber}`,
        order_id: createRes.razorpayOrderId,
        prefill: createRes.prefill,
        theme: { color: '#a855f7' }, // neon purple
        notes: { orderNumber: createRes.orderNumber },
        handler: async (resp: RazorpayHandlerResponse) => {
          try {
            await api<VerifyResponse>('/payments/verify', {
              method: 'POST',
              token: accessToken,
              body: JSON.stringify(resp),
            });
            router.push(`/orders/${createRes.orderNumber}/success`);
          } catch (err) {
            // Verify failed — webhook will still reconcile. Show recovery UI.
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(`Payment captured but verification failed (${msg}). You'll receive an email shortly if successful.`);
            router.push(`/orders/${createRes.orderNumber}/pending`);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError('Payment cancelled. You can try again.');
          },
        },
      });

      rz.on('payment.failed', (resp: RazorpayFailure) => {
        setError(`Payment failed: ${resp.error.description} (${resp.error.code})`);
        setSubmitting(false);
      });

      rz.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Payment method</legend>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="method"
            value="RAZORPAY"
            checked={method === 'RAZORPAY'}
            onChange={() => setMethod('RAZORPAY')}
          />
          <span>UPI / Card / NetBanking / Wallet</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="method"
            value="COD"
            checked={method === 'COD'}
            onChange={() => setMethod('COD')}
          />
          <span>Cash on Delivery</span>
        </label>
      </fieldset>

      <button
        type="button"
        onClick={pay}
        disabled={submitting || (method === 'RAZORPAY' && scriptState === 'error')}
        className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
      >
        {submitting
          ? 'Processing…'
          : method === 'COD'
          ? 'Place Order (Cash on Delivery)'
          : scriptState === 'loading'
          ? 'Loading payment…'
          : 'Pay now'}
      </button>

      {error && (
        <div role="alert" className="rounded-md bg-red-950 border border-red-700 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
```

---

## 9. Error handling matrix

| Scenario | Client sees | Server state | Recovery |
|----------|-------------|--------------|----------|
| `/payments/create` 5xx | Error banner, can retry | No payment created | Retry `create` |
| Modal dismissed | "Payment cancelled" | Payment=CREATED, no capture | User can retry |
| `payment.failed` (gateway-side, e.g. insufficient funds) | Gateway error msg | Payment=FAILED | User can retry — new `/create` call |
| `/verify` 4xx (bad signature) | Generic "verification failed" | Payment=FAILED | Unlikely except tampering; audit log |
| `/verify` network error BUT capture succeeded | "Captured, confirming…" → redirect to `/pending` | Webhook will converge | User lands on pending page, refreshes |
| Webhook received before `/verify` | N/A | Webhook applies first; `/verify` becomes idempotent no-op | None needed |
| User clicks back after capture | — | State already CONFIRMED | Redirect to success |
| COD: order above ₹5000 | ValidationError | No change | Switch to Razorpay |
| COD: pincode not serviceable | ValidationError | No change | Edit address |
| Refund: already fully refunded | ConflictError | No change | — |

**Frontend principle:** never block the user on `/verify` completion. If capture happened (handler fired), trust the webhook. Show a "we'll email you when confirmed" state instead of "ERROR".

---

## 10. Testing & launch checklist

### Local test cards (Razorpay test mode)
- **Success**: `4111 1111 1111 1111`, CVV any, expiry any future
- **Failure**: `5104 0600 0000 0008`
- **OTP**: `1234`
- **UPI**: `success@razorpay` / `failure@razorpay`

### Webhook local testing
Use `ngrok http 4000`; set webhook URL in Razorpay dashboard to `https://<ngrok>.ngrok.io/api/v1/payments/webhook`. Trigger events from Dashboard → Webhooks → "Send Test Event".

### Pre-production checklist

- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` set (live values)
- [ ] Webhook URL registered in Razorpay dashboard, events: `payment.captured`, `payment.failed`, `refund.processed`
- [ ] `ProcessedWebhookEvent` migration applied
- [ ] End-to-end test: browse → add → checkout → pay (UPI on phone) → verify order CONFIRMED → verify webhook received → verify Printrove order created
- [ ] End-to-end test: COD → verify order CONFIRMED, no Razorpay call
- [ ] End-to-end test: admin refund → verify `refund.processed` webhook → verify order REFUNDED
- [ ] Test signature rejection: send bad signature to `/verify` → 422
- [ ] Test webhook dedupe: send same event twice → only first applies
- [ ] KYC completed on Razorpay account (live payments require this)
- [ ] Settlement bank account verified
- [ ] COD cap (₹5000) tuned based on initial data
- [ ] Failed-payment analytics in PostHog (track dismissal reasons)

### Monitoring alerts (Sentry/PostHog)
- `/payments/verify` 4xx rate > 1% in 5 min
- Webhook processing latency > 2s
- Printrove push failure rate > 5%
- Any `RefundStatus.FAILED` row created

---

## Files changed/added in this phase

### Backend
- `prisma/schema.prisma` — add `ProcessedWebhookEvent`, `Receipt` models (see §2)
- `apps/api/src/modules/payments/payments.schema.ts` — add `method` field + refund schema
- `apps/api/src/modules/payments/payments.service.ts` — enhanced: COD, idempotent webhooks, full refund
- `apps/api/src/modules/payments/payments.controller.ts` — add refund, webhook-idempotent
- `apps/api/src/modules/payments/payments.routes.ts` — `POST /refund` admin route
- `apps/api/src/modules/orders/orders.service.ts` — `receipt()` method
- `apps/api/src/modules/orders/orders.routes.ts` — `GET /:id/receipt`

### Frontend
- `apps/web/src/types/razorpay.ts` — Razorpay types + global window augmentation
- `apps/web/src/lib/api.ts` — typed fetch wrapper
- `apps/web/src/hooks/useRazorpayScript.ts` — deduped script loader
- `apps/web/src/components/checkout/CheckoutButton.tsx` — full checkout UI
- `apps/web/src/app/checkout/page.tsx` — checkout page skeleton
