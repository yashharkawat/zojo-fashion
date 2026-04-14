# Zojo Fashion API

Express + TypeScript (strict) + Prisma + PostgreSQL backend.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env   # edit secrets

# 3. Generate Prisma client + run migrations
npm run prisma:generate
npm run prisma:migrate

# 4. Dev server (tsx watch)
npm run dev

# Health check
curl http://localhost:4000/health
```

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` | tsx watch hot reload |
| `build` | `tsc` → `dist/` |
| `start` | Run compiled JS |
| `typecheck` | `tsc --noEmit` (run before every push) |
| `lint` | ESLint over `src/` |
| `prisma:generate` | Generate Prisma client from `../../prisma/schema.prisma` |
| `prisma:migrate` | Create + apply a dev migration |
| `prisma:studio` | Visual DB explorer |
| `seed` | Run `src/scripts/seed.ts` (TODO) |

## Project layout

```
src/
├── server.ts           # Bootstrap + graceful shutdown
├── app.ts              # Express app factory (testable)
├── config/             # env, prisma, logger
├── types/              # ApiResponse, AuthContext, express module aug
├── middleware/         # requestId, auth, rbac, validate, rateLimit, errorHandler
├── lib/                # errors, response, asyncHandler, jwt, password, razorpay, printrove
├── utils/              # orderNumber, money (paise helpers, GST, shipping)
└── modules/
    ├── auth/           # register, login, refresh (rotation), logout, me
    ├── products/       # list + filters, get, category, create/update (admin)
    ├── orders/         # create, my, one, cancel
    ├── payments/       # Razorpay create/verify + webhook (raw body)
    ├── wishlist/       # get, add (idempotent), remove
    └── admin/          # orders list, status update, analytics, products
```

Each module: **routes → controller → service**. Controllers are thin;
services own business logic and Prisma calls.

## Endpoint cheat sheet

See `../../API_DESIGN.md` for the full contract. Summary:

```
AUTH
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh     (refresh cookie)
POST   /api/v1/auth/logout
GET    /api/v1/auth/me          (Bearer)

PRODUCTS
GET    /api/v1/products
GET    /api/v1/products/:id
GET    /api/v1/products/category/:slug
POST   /api/v1/products         (admin)
PUT    /api/v1/products/:id     (admin)

ORDERS
POST   /api/v1/orders           (Bearer)
GET    /api/v1/orders/my        (Bearer)
GET    /api/v1/orders/:id       (Bearer)
PUT    /api/v1/orders/:id/cancel (Bearer)

PAYMENTS
POST   /api/v1/payments/create  (Bearer)
POST   /api/v1/payments/verify  (Bearer)
POST   /api/v1/payments/webhook (Razorpay — raw body + HMAC)

WISHLIST
GET    /api/v1/wishlist         (Bearer)
POST   /api/v1/wishlist         (Bearer)
DELETE /api/v1/wishlist/:productId (Bearer)

ADMIN (admin role)
GET    /api/v1/admin/orders
PUT    /api/v1/admin/orders/:id/status
GET    /api/v1/admin/analytics
GET    /api/v1/admin/products
```

## Key implementation notes

- **Envelope**: `{ data, error, meta: { requestId, pagination? } }` — uniform.
- **Errors**: `AppError` hierarchy → `errorHandler` → JSON body. Prisma `P2002`/`P2025` auto-mapped.
- **Auth**: Access JWT (15m, HS256) in `Authorization: Bearer`; refresh opaque token SHA-256-hashed in DB, delivered as `httpOnly` cookie scoped to `/api/v1/auth`. Rotation + reuse-detection.
- **Passwords**: argon2id (19 MiB, t=2).
- **Razorpay**: `orders.create` → client Checkout.js → `/verify` with HMAC-SHA256 signature (timing-safe). **Webhook is source of truth** — idempotent by event id (add `processed_events` table for prod).
- **Printrove**: `pushOrder()` with 3× exponential backoff. On failure, `printroveSyncStatus=FAILED` + retry counter; admin can re-push.
- **Money**: all paise (Int). GST 5%/12% based on unit price.
- **Validation**: Zod schemas at every route. Inferred types shared with controllers.
- **Security**: helmet, CORS allowlist, 1 MB body cap, rate limits per route, pino redaction for auth/signature fields.

## TODO before production

- [ ] Seed script (admin user, sample products, collection, banner)
- [ ] `processed_webhook_events` table for webhook idempotency
- [ ] BullMQ worker for Printrove push + email
- [ ] Address CRUD endpoints (schema + routes)
- [ ] Categories CRUD (admin)
- [ ] Printrove webhook handler (status → SHIPPED/DELIVERED)
- [ ] Coupon module (apply/validate endpoint)
- [ ] Review module (create, list, moderate)
- [ ] Unit + integration tests (Vitest + Supertest)
- [ ] OpenAPI 3.1 generation from Zod schemas
