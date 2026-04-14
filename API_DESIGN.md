# Zojo Fashion — REST API Design & Implementation

> Node.js + Express + TypeScript (strict) + Prisma + PostgreSQL
> JWT auth • Razorpay payments • Printrove POD
>
> This document is the authoritative API spec. Code in `apps/api/src/` implements it.

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [TypeScript Setup](#2-typescript-setup)
3. [Project Layout](#3-project-layout)
4. [Middleware Pipeline](#4-middleware-pipeline)
5. [Error Model](#5-error-model)
6. [Auth Module](#6-auth-module)
7. [Products Module](#7-products-module)
8. [Orders Module](#8-orders-module)
9. [Payments Module](#9-payments-module)
10. [Wishlist Module](#10-wishlist-module)
11. [Admin Module](#11-admin-module)
12. [Security Checklist](#12-security-checklist)

---

## 1. Global Conventions

### Base URL
```
Production:  https://api.zojofashion.com/api/v1
Local:       http://localhost:4000/api/v1
```

### Versioning
URL-path versioning (`/api/v1`). Breaking changes → `/api/v2`. Non-breaking additions don't bump.

### Request format
- JSON body (`Content-Type: application/json`)
- `Authorization: Bearer <accessToken>` for protected routes
- `X-Request-Id` auto-generated per request (UUID), echoed in response

### Response envelope
Every response is one of:

**Success**
```json
{ "data": { ... }, "error": null, "meta": { "requestId": "..." } }
```

**Collection (paginated)**
```json
{
  "data": [ ... ],
  "error": null,
  "meta": {
    "requestId": "...",
    "pagination": { "page": 1, "pageSize": 20, "total": 153, "totalPages": 8 }
  }
}
```

**Error**
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "path": "body.email", "message": "Invalid email" } ]
  },
  "meta": { "requestId": "..." }
}
```

### HTTP status conventions
| Code | Use |
|------|-----|
| 200 | OK (GET, PUT, PATCH success) |
| 201 | Created (POST success) |
| 204 | No Content (DELETE success) |
| 400 | Malformed request |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but forbidden (RBAC) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, already cancelled) |
| 422 | Validation error (business rule) |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 503 | Upstream (Razorpay/Printrove) unavailable |

### Pagination (list endpoints)
Query params: `?page=1&pageSize=20&sort=-createdAt`
- `page` ≥ 1 (default 1)
- `pageSize` 1–100 (default 20)
- `sort` field name; `-` prefix = DESC

### Idempotency
`POST /orders` and `POST /payments/*` accept `Idempotency-Key` header.
Stored in Redis (or DB table) for 24h. Duplicate key → replay cached response.

### Rate limits (per IP)
- Global: 100 req/min
- `/auth/*`: 10 req/min (brute-force protection)
- `/payments/*`: 5 req/min
- Admin: 300 req/min

---

## 2. TypeScript Setup

### `tsconfig.json` — strict mode
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "incremental": true,
    "sourceMap": true,

    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@config/*": ["config/*"],
      "@middleware/*": ["middleware/*"],
      "@lib/*": ["lib/*"],
      "@modules/*": ["modules/*"],
      "@types": ["types"],
      "@utils/*": ["utils/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Core type contracts (`src/types/api.ts`)
```typescript
import { Request } from 'express';
import { UserRole } from '@prisma/client';

/** Standard API envelope */
export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: ResponseMeta;
}

export interface ApiError {
  data: null;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ResponseMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ResponseMeta {
  requestId: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

/** Authenticated request context */
export interface AuthContext {
  userId: string;
  role: UserRole;
  email: string;
}

/** Typed Express Request with auth */
export interface AuthedRequest<B = unknown, Q = unknown, P = unknown>
  extends Request<P, unknown, B, Q> {
  auth: AuthContext;
  requestId: string;
}
```

### Zod schemas as single source of truth
All request validation uses **Zod**. Types are inferred, never duplicated.

```typescript
import { z } from 'zod';

export const registerBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be +91XXXXXXXXXX'),
});

export type RegisterBody = z.infer<typeof registerBody>;
```

---

## 3. Project Layout

```
apps/api/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── server.ts                  # Bootstrap + graceful shutdown
│   ├── app.ts                     # Express app (composable for tests)
│   ├── config/
│   │   ├── env.ts                 # Typed env via Zod
│   │   ├── prisma.ts              # Prisma singleton
│   │   └── logger.ts              # Pino JSON logger
│   ├── types/
│   │   ├── api.ts                 # ApiResponse, AuthContext, ...
│   │   └── express.d.ts           # Module augmentation for req.auth, req.requestId
│   ├── middleware/
│   │   ├── requestId.ts           # Assigns req.requestId
│   │   ├── auth.ts                # JWT verify → req.auth
│   │   ├── rbac.ts                # requireRole('ADMIN', ...)
│   │   ├── validate.ts            # Zod validator factory
│   │   ├── rateLimit.ts
│   │   └── errorHandler.ts        # Global error → ApiError envelope
│   ├── lib/
│   │   ├── errors.ts              # AppError hierarchy
│   │   ├── jwt.ts                 # sign/verify access + refresh
│   │   ├── password.ts            # argon2id hash/verify
│   │   ├── response.ts            # ok() / paginated() helpers
│   │   ├── asyncHandler.ts        # wraps async route handlers
│   │   ├── razorpay.ts            # Razorpay SDK wrapper + signature verify
│   │   └── printrove.ts           # Printrove client + retry
│   ├── utils/
│   │   ├── orderNumber.ts         # ZJ-YYYY-NNNNNN generator
│   │   └── money.ts               # paise helpers
│   └── modules/
│       ├── auth/
│       │   ├── auth.schema.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   └── auth.routes.ts
│       ├── products/...
│       ├── orders/...
│       ├── payments/...
│       ├── wishlist/...
│       └── admin/...
```

Module pattern: **routes → controller (thin) → service (business logic) → Prisma**.
Controllers never touch Prisma directly.

---

## 4. Middleware Pipeline

Request flows top-to-bottom:

```
1. helmet()                        security headers
2. cors({ origin: allowlist })     CORS
3. express.json({ limit: '1mb' })  body parser
4. requestId                       attach UUID to req.requestId
5. pinoHttp                        structured request logging
6. rateLimit (global)              100/min/IP
7. route matcher
   ├─ public routes: no auth
   └─ protected routes:
       ├─ authMiddleware           verify JWT → req.auth
       ├─ requireRole('ADMIN')     for admin routes only
       ├─ validate({ body, query, params }) Zod validation
       └─ controller handler (wrapped in asyncHandler)
8. errorHandler                    catch-all; formats AppError → ApiError
```

### Auth middleware contract
```typescript
// middleware/auth.ts
export const authMiddleware: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token'));
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token); // { sub, role, email }
    (req as AuthedRequest).auth = {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};
```

### Validate middleware (Zod factory)
```typescript
// middleware/validate.ts
type Schemas = { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };
export const validate = (schemas: Schemas): RequestHandler => (req, _res, next) => {
  try {
    if (schemas.body)   req.body   = schemas.body.parse(req.body);
    if (schemas.query)  req.query  = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new ValidationError(err.issues));
    }
    next(err);
  }
};
```

---

## 5. Error Model

### AppError hierarchy
```typescript
// lib/errors.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR' as const;
}
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED' as const;
}
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN' as const;
}
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND' as const;
}
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT' as const;
}
export class UpstreamError extends AppError {
  readonly statusCode = 503;
  readonly code = 'UPSTREAM_ERROR' as const;
}
```

### Global error handler
```typescript
// middleware/errorHandler.ts
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as AuthedRequest).requestId;
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      data: null,
      error: { code: err.code, message: err.message, details: err.details },
      meta: { requestId },
    });
  }
  logger.error({ err, requestId }, 'Unhandled error');
  return res.status(500).json({
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: { requestId },
  });
};
```

---

## 6. Auth Module

### Token strategy
- **Access JWT**: HS256, 15-min TTL, carries `{ sub, role, email }`. Sent in `Authorization` header.
- **Refresh token**: Opaque 64-byte random string. Store SHA-256 hash in DB (`RefreshToken` table). Delivered as `httpOnly; Secure; SameSite=Lax` cookie scoped to `/api/v1/auth/refresh`.
- **Rotation**: Every `/auth/refresh` revokes the old token and issues a new one. Reuse of revoked token = all refresh tokens for user revoked (reuse detection).
- **Password hashing**: `argon2id` (memory-hard, preferred over bcrypt).

### Endpoints

#### `POST /api/v1/auth/register`
**Body**
```json
{
  "email": "otaku@example.com",
  "password": "strongpass123",
  "firstName": "Rahul",
  "lastName": "Sharma",
  "phone": "+919876543210"
}
```
**201 Response**
```json
{
  "data": {
    "user": { "id": "cuid...", "email": "...", "firstName": "...", "role": "CUSTOMER" },
    "accessToken": "eyJ..."
  },
  "error": null,
  "meta": { "requestId": "..." }
}
```
Sets `Set-Cookie: rt=<raw>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`.

**Errors**: `409 CONFLICT` if email exists; `422 VALIDATION_ERROR` for bad input.

#### `POST /api/v1/auth/login`
**Body**: `{ "email", "password" }` → same response as register.
**Errors**: `401 UNAUTHORIZED` for invalid credentials (generic message — don't reveal which field).

#### `POST /api/v1/auth/refresh`
No body. Reads `rt` cookie. Rotates token.
**200**: `{ "accessToken": "..." }` + new `rt` cookie.
**401**: missing/invalid/expired/revoked refresh token.

#### `POST /api/v1/auth/logout`
Revokes current refresh token; clears cookie. Returns `204`.

#### `GET /api/v1/auth/me` — auth required
**200**: `{ "data": { "id", "email", "firstName", "lastName", "phone", "role", "gstin" } }`.

---

## 7. Products Module

### `GET /api/v1/products`
Public list with filters.

**Query**
| Param | Type | Notes |
|-------|------|-------|
| `page` | int ≥1 | default 1 |
| `pageSize` | int 1–100 | default 20 |
| `category` | string (slug) | optional |
| `anime` | string | e.g. `Naruto` |
| `size` | string | `S|M|L|XL|XXL` (matches any variant) |
| `color` | string | |
| `priceMin` / `priceMax` | int (paise) | |
| `sort` | enum | `-createdAt` (default, newest), `price`, `-price`, `-soldCount`, `-avgRating` |
| `search` | string | title/description ILIKE |

**200 Response**
```json
{
  "data": [
    {
      "id": "cuid",
      "slug": "naruto-sage-mode-oversized",
      "title": "Naruto Sage Mode Oversized Tee",
      "basePrice": 89900,
      "compareAtPrice": 119900,
      "animeSeries": "Naruto",
      "gender": "MEN",
      "primaryImage": { "url": "https://...", "alt": "..." },
      "avgRating": 4.6,
      "reviewCount": 42,
      "availableSizes": ["S","M","L","XL","XXL"],
      "availableColors": [{ "name": "Black", "hex": "#000000" }]
    }
  ],
  "error": null,
  "meta": { "pagination": { "page": 1, "pageSize": 20, "total": 153, "totalPages": 8 } }
}
```

### `GET /api/v1/products/:id`
Accepts either CUID or slug (detect by regex). Returns full product with all variants, images, and first 10 approved reviews.

### `GET /api/v1/products/category/:slug`
Shortcut for `GET /products?category=<slug>`. Same response shape.

### `POST /api/v1/products` — admin
**Body**
```json
{
  "slug": "...",
  "title": "...",
  "description": "...",
  "categoryId": "cuid",
  "basePrice": 89900,
  "compareAtPrice": 119900,
  "gender": "MEN",
  "animeSeries": "Naruto",
  "tags": ["oversized","anime"],
  "material": "100% cotton, 240 GSM",
  "variants": [
    { "sku": "ZJ-NAR-TEE-BLK-M", "size": "M", "color": "Black", "colorHex": "#000000", "price": 89900, "printroveVariantId": "pv_xxx" }
  ],
  "images": [
    { "url": "...", "publicId": "...", "alt": "...", "sortOrder": 0, "isPrimary": true }
  ]
}
```
**201**: full created product.

### `PUT /api/v1/products/:id` — admin
Full replace of updatable fields. Variants and images are replaced atomically in a transaction. Use `PATCH` only if partial updates become common (not in v1).

---

## 8. Orders Module

### Order state machine (authoritative)
```
PENDING ──pay success──▶ CONFIRMED ──push to Printrove──▶ PRINTING
                                                              │
                                                         ship webhook
                                                              ▼
                          DELIVERED ◀──deliver webhook── SHIPPED
                             │
              (rare)    any state    admin refund
                             ▼            ▼
                       CANCELLED     REFUNDED
```

User can cancel from `PENDING` or `CONFIRMED` only. Admin can cancel/refund from any state pre-`DELIVERED`.

### `POST /api/v1/orders` — auth required
Creates order in `PENDING` status. Does NOT charge yet — client then calls `/payments/create`.

**Body**
```json
{
  "items": [
    { "variantId": "cuid", "quantity": 1 }
  ],
  "shippingAddressId": "cuid",
  "couponCode": "OTAKU10",
  "notes": "Leave at security"
}
```
Backend:
1. Re-fetch all variants → verify active, not deleted, get server-side price
2. Compute `subtotal`, apply coupon → `discountAmount`
3. Compute `shippingFee` (flat or by pincode)
4. Compute `taxAmount` (GST 5% apparel < ₹1000, 12% >= ₹1000)
5. Snapshot address, items, titles, images
6. Create `Order` row + `OrderItem`s + `OrderStatusEvent` (PENDING) in one transaction
7. Return order

**201**
```json
{
  "data": {
    "id": "cuid",
    "orderNumber": "ZJ-2026-000123",
    "status": "PENDING",
    "total": 94800,
    "items": [ ... ],
    "shippingAddress": { ... snapshot ... },
    "createdAt": "2026-04-13T..."
  }
}
```

### `GET /api/v1/orders/my` — auth
List current user's orders, newest first. Paginated.

### `GET /api/v1/orders/:id` — auth
Returns order if owned by user (or user is admin).

### `PUT /api/v1/orders/:id/cancel` — auth
Transitions to `CANCELLED` if current status is `PENDING` or `CONFIRMED`. If `CONFIRMED` (already paid), triggers Razorpay refund in background.

**Body**: `{ "reason": "Changed my mind" }` (optional)
**409 CONFLICT** if order already shipped/delivered.

---

## 9. Payments Module (Razorpay)

### Flow
```
Client                          Server                         Razorpay
  │  POST /payments/create        │                                │
  │  { orderId }                  │                                │
  │ ────────────────────────────▶ │                                │
  │                               │  orders.create({ amount, ... })│
  │                               │ ─────────────────────────────▶ │
  │                               │ ◀───────────────────────────── │
  │ ◀────────────────────────────  │  { razorpayOrderId, keyId }   │
  │                                                                │
  │  Open Razorpay Checkout.js modal                               │
  │  User pays                                                     │
  │ ──────────────────────────────────────────────────────────────▶│
  │ ◀──────────────────────────────────────────────────────────────│
  │  { payment_id, order_id, signature }                           │
  │                                                                │
  │  POST /payments/verify        │                                │
  │  { ...signature payload }     │                                │
  │ ────────────────────────────▶ │                                │
  │                               │  HMAC verify                   │
  │                               │  → Order.status = CONFIRMED    │
  │                               │  → async: push to Printrove    │
  │                               │  → async: send email           │
  │ ◀──────────────────────────── │                                │
  │                                                                │
  │                               │ ◀──────────────────────────────│
  │                               │  webhook: payment.captured     │
  │                               │  (source of truth — idempotent)│
```

### `POST /api/v1/payments/create` — auth
**Body**: `{ "orderId": "cuid" }`
Validations: order belongs to user, status=`PENDING`, no existing `Payment`.

**201**
```json
{
  "data": {
    "razorpayOrderId": "order_Abc123",
    "amount": 94800,
    "currency": "INR",
    "keyId": "rzp_test_xxx",
    "orderNumber": "ZJ-2026-000123",
    "prefill": { "name": "Rahul", "email": "...", "contact": "+91..." }
  }
}
```

### `POST /api/v1/payments/verify` — auth
**Body**
```json
{
  "razorpay_order_id": "order_Abc123",
  "razorpay_payment_id": "pay_Xyz456",
  "razorpay_signature": "hex..."
}
```
Backend:
1. Look up `Payment` by `razorpayOrderId`, verify belongs to requesting user's order
2. Compute `HMAC_SHA256(order_id + '|' + payment_id, key_secret)` and compare (timing-safe)
3. If valid: `Payment.status=CAPTURED`, `Order.status=CONFIRMED`, log `OrderStatusEvent`
4. Enqueue Printrove push (non-blocking — even if this fails, webhook will catch up)
5. Enqueue order confirmation email

**200**: `{ "data": { "orderNumber": "...", "status": "CONFIRMED" } }`
**422** if signature invalid.

### `POST /api/v1/payments/webhook` — public (signature-verified)
- No JWT. Verify `X-Razorpay-Signature` using webhook secret (different from key_secret).
- Parse event: `payment.captured`, `payment.failed`, `refund.processed`.
- **Idempotent**: store `event.id` in `processed_webhook_events` table; skip if seen.
- For `payment.captured`: same effect as `/verify` but from Razorpay directly. Both paths converge safely.
- Respond **200 within 5s** even if processing continues async, else Razorpay retries.

---

## 10. Wishlist Module

### `GET /api/v1/wishlist` — auth
```json
{
  "data": {
    "items": [
      {
        "id": "cuid",
        "product": { "id","slug","title","basePrice","primaryImage" },
        "addedAt": "..."
      }
    ]
  }
}
```

### `POST /api/v1/wishlist` — auth
**Body**: `{ "productId": "cuid" }`
- Creates `Wishlist` if user has none
- Adds item (idempotent on `[wishlistId, productId]` unique)
**201** returns added item. **200** with existing item if duplicate.

### `DELETE /api/v1/wishlist/:productId` — auth
Removes by product id (not wishlist item id — more RESTful for clients).
**204** on success, **404** if not in wishlist.

---

## 11. Admin Module

All endpoints require `role IN (ADMIN, SUPPORT, SUPER_ADMIN)`. Writes require `ADMIN` or `SUPER_ADMIN`.

### `GET /api/v1/admin/orders`
**Query**: `status`, `userId`, `orderNumber`, `dateFrom`, `dateTo`, `page`, `pageSize`, `sort`.
Returns paginated list with user info joined.

### `PUT /api/v1/admin/orders/:id/status`
**Body**: `{ "status": "SHIPPED", "reason": "...", "trackingInfo": { "courier": "...", "awb": "..." } }`

Rules:
- Validates allowed transitions (can't go `DELIVERED` → `PENDING`)
- Writes `OrderStatusEvent` with `source=ADMIN`, `actorId=auth.userId`
- If → `SHIPPED`, updates `Shipment` row and sends tracking SMS/email
- If → `REFUNDED`, initiates Razorpay refund and writes `Refund` row

### `GET /api/v1/admin/analytics`
**Query**: `from` (ISO date), `to` (ISO date). Defaults to last 30 days.
```json
{
  "data": {
    "range": { "from": "2026-03-14", "to": "2026-04-13" },
    "revenue": { "gross": 850000, "net": 810000, "refunds": 40000 },
    "orders": { "total": 92, "paid": 85, "cancelled": 4, "refunded": 3 },
    "aov": 9529,
    "topProducts": [ { "productId", "title", "unitsSold", "revenue" } ],
    "topAnimeSeries": [ { "series": "Naruto", "orders": 28, "revenue": 240000 } ],
    "conversionFunnel": { "carts": 412, "checkoutStarted": 118, "paid": 85 }
  }
}
```

### `GET /api/v1/admin/products`
Admin product list (includes inactive/deleted). Extra fields: `soldCount`, `avgRating`, `createdAt`, `printroveSyncStatus`. Query filters on status, sync state, category.

---

## 12. Security Checklist

- [x] `helmet()` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [x] CORS allow-list (only `https://zojofashion.com` + preview domains in prod)
- [x] Body size cap (1 MB)
- [x] Rate limiting (global + per-route)
- [x] Argon2id password hashing
- [x] Refresh token rotation + reuse detection
- [x] JWT short TTL (15m), refresh in httpOnly cookie
- [x] Timing-safe HMAC verification for Razorpay signatures
- [x] Webhook idempotency (processed_event_ids table)
- [x] Zod validation at every boundary
- [x] Prisma parameterized queries (no SQL injection surface)
- [x] No secrets in logs (Pino redaction list)
- [x] Audit log for admin actions
- [x] Never expose Prisma errors to clients (global error handler normalizes)

---

## Implementation

All source files live under `apps/api/src/`. Key files:
- `app.ts` — composes middleware + routers
- `modules/auth/*.ts` — complete auth implementation
- `modules/payments/*.ts` — Razorpay integration
- `modules/orders/*.ts` — order lifecycle
- `modules/products/*.ts`, `modules/wishlist/*.ts`, `modules/admin/*.ts`

See the source for full implementations. This document remains the contract.
