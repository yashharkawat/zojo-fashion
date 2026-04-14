# Zojo Fashion — Project Plan & Conversation Notes

> Anime/otaku-themed premium men's clothing brand, India-first, print-on-demand.
> This document captures the full design conversation, decisions made, and the development roadmap.

---

## 1. Product Summary

| Attribute | Value |
|-----------|-------|
| Brand | Zojo Fashion |
| Niche | Anime / otaku-themed premium men's clothing |
| Target | Indian anime fans, men 18–30 |
| Fulfillment | Print-on-demand via **Printrove** API |
| Payments | **Razorpay** (UPI, cards, netbanking, COD) |
| Launch scale | <1,000 users |
| Timeline | ~1 week MVP |
| UI/UX reference | TheSouledStore.com — clean grid, dark aesthetic, collection-driven merchandising |
| Aesthetic | Dark mode, neon purple/pink on near-black, mobile-first |

---

## 2. Tech Stack (locked)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT access tokens (15m) + Refresh tokens (7d, rotated, httpOnly cookie) |
| Payments | Razorpay (orders API + Checkout.js + webhook) |
| POD | Printrove API (product mapping + order push + status webhooks) |
| Images | Cloudinary (signed direct uploads, on-the-fly transforms) |
| Email | Resend |
| SMS | MSG91 (OTP + order updates) |
| State (FE) | Zustand (cart, auth) + TanStack Query (server state) |
| Hosting — FE | Vercel |
| Hosting — BE | Railway |
| Hosting — DB | Supabase (managed Postgres + pgBouncer) |
| Analytics | PostHog + Meta Pixel + Vercel Analytics |
| Errors | Sentry (FE + BE) |

### Stack caveat (recorded)
We flagged that a Next.js-only monolith (API Routes) would cut ~2 days off the 1-week MVP vs. the split FE/BE. User chose the split for future mobile-app optionality. Accepted.

---

## 3. Features (MVP scope)

**In scope for week 1:**
- Auth: register, login, refresh, logout, me (JWT + refresh rotation)
- Product catalog: PLP with filters (category, anime series, size, color, price), PDP with variant picker
- Collections (anime series drops) + homepage banners (CMS-driven from DB)
- Cart: guest (localStorage) + authenticated (DB), merge on login
- Checkout: address selection, pincode validation, Razorpay flow, signature verify, webhook confirm
- Orders: my orders, order detail, tracking page
- Fulfillment: automatic Printrove push on payment success, webhook-driven status updates
- Admin: product/variant CRUD, collection + banner management, order list + manual status override
- Instagram feed embed on home
- Wishlist, Reviews, Coupons (stretch — included in schema, built if time allows)
- Transactional emails: order confirmed, shipped, delivered
- Mobile-first responsive, dark anime aesthetic

**Explicitly cut from week 1:**
Abandoned cart emails, recommendations engine, returns/RMA flow, gift cards, blog, multi-currency, GST invoice generation (plan week 2), newsletter signup automation, advanced search (Meilisearch).

---

## 4. System Architecture (summary)

```
User (mobile)
   │
   ▼
Vercel (Next.js 14) ──── Cloudinary CDN (images)
   │  Bearer JWT
   ▼
Railway (Express API) ───┬── Supabase Postgres (Prisma)
                         ├── Razorpay API + webhooks
                         ├── Printrove API + webhooks
                         ├── Cloudinary signed uploads
                         └── Resend / MSG91
```

### Key architectural decisions (ADRs)

| # | Decision | Why |
|---|----------|-----|
| 001 | Split FE/BE (Vercel + Railway) | User preference; future mobile app reuse |
| 002 | Prisma direct (no Repository pattern) | Mostly CRUD; YAGNI at this scale |
| 003 | POD inventory model: effectively unlimited stock | Printrove owns fulfillment; don't track stock |
| 004 | **Razorpay webhook is source of truth** for payment | Client-side verify can be lost; webhook is retried |
| 005 | Admin lives inside Next.js app, role-gated | Saves a second frontend for v1 |
| 006 | CMS = DB tables + admin UI (no headless CMS) | Full control, $0 cost, sufficient for MVP |
| 007 | Money stored as **paise (Int)** | Never float/decimal for currency |
| 008 | Snapshot pricing on cart/order items | Price changes mid-session don't burn users |
| 009 | Address snapshot as JSON on Order | Address edits don't rewrite order history |
| 010 | `printroveVariantId` required on every variant | Single most important mapping — fulfillment breaks without it |

---

## 5. Critical Flow: Checkout & Payment

```
1. Client → POST /checkout/validate
   Backend: re-price from DB, verify pincode, compute totals → checkoutToken

2. Client → POST /payments/razorpay/order
   Backend: create Order row (PENDING_PAYMENT), razorpay.orders.create()
   → returns { razorpayOrderId, amount, key_id }

3. Client opens Razorpay Checkout.js modal → user pays (UPI/card/netbanking)

4. Client → POST /payments/razorpay/verify (signature_payload)
   Backend: HMAC-SHA256 verify → mark Order PAID → trigger Printrove push → email

5. [Parallel] Razorpay → POST /webhooks/razorpay (payment.captured)
   Backend: verify signature, idempotent update (source of truth)

6. Order → Printrove push: save printroveOrderId, status=SENT_TO_PRINTROVE
   On failure: 3x exponential backoff retry, then admin alert for manual retry
```

**Idempotency required on:** `/payments/razorpay/verify`, `/webhooks/razorpay`, `/webhooks/printrove` — use `Idempotency-Key` header or event ID.

---

## 6. Order Status State Machine

```
PENDING_PAYMENT ──pay─▶ CONFIRMED ──push─▶ PRINTING ──ship─▶ SHIPPED ──deliver─▶ DELIVERED
       │                    │                 │                 │
       └──cancel──▶ CANCELLED                 └── (if issue) ──▶ CANCELLED / REFUNDED
```

User-requested statuses are exactly modeled in the `OrderStatus` enum in the Prisma schema.

---

## 7. Database Schema

Full Prisma schema is in `prisma/schema.prisma`. Key notes:

- **10 core models** + supporting models (RefreshToken, ProductImage, AuditLog, etc.)
- Money in paise (Int)
- Separate `Address` model (reusable) + `shippingAddressSnapshot` JSON on Order
- India-specific: `phone` (E.164), `pincode` (6-digit validated at app layer), `gstin` (optional on User/Order for B2B)
- Printrove sync fields on `ProductVariant` and `Order`
- Razorpay tracking on `Payment` model (1:1 with Order, separate for refund auditability)
- Soft delete via `deletedAt` on Product/Variant (never hard-delete — orders reference them)
- Price snapshots on CartItem & OrderItem
- Indexes on all hot paths (see schema)

---

## 8. Repository Layout (planned)

```
zojo-fashion/
├── PROJECT_PLAN.md               ← this file
├── prisma/
│   └── schema.prisma             ← complete Prisma schema
├── apps/
│   ├── web/                      ← Next.js 14 (Vercel)
│   │   ├── src/app/(storefront)/
│   │   ├── src/app/(account)/
│   │   ├── src/app/(admin)/
│   │   └── src/lib/
│   └── api/                      ← Express + TS (Railway)
│       ├── src/routes/
│       ├── src/controllers/
│       ├── src/services/
│       ├── src/middleware/
│       ├── src/lib/
│       └── src/webhooks/
├── packages/
│   └── shared/                   ← Zod schemas + shared types (FE + BE)
└── turbo.json                    ← Turborepo config
```

---

## 9. One-Week Delivery Plan

| Day | Deliverables |
|-----|--------------|
| **0** (half day) | Monorepo scaffold, all accounts (Railway/Supabase/Vercel/Cloudinary/Razorpay test/Printrove sandbox), Prisma migrate, CI, env templates |
| **1** | Express skeleton + auth (register/login/refresh/me, JWT + rotation), seed admin + products, Railway deploy, `/health` confirmed from Vercel |
| **2** | Catalog + CMS: product/collection/banner CRUD, Cloudinary signed uploads, admin UI (login, product editor, collection manager) |
| **3** | Storefront: dark theme, home (hero + collections + IG embed), PLP with filters (SSR), PDP (variants, gallery, size guide) |
| **4** | Cart (Zustand guest + DB auth), merge on login, address CRUD, Razorpay order creation, Checkout.js, signature verify, webhook |
| **5** | Printrove integration (product mapping + order push + retry), Printrove status webhook, my orders + tracking, order emails |
| **6** | Polish: mobile QA on real devices, SEO (metadata, OG, sitemap, structured data), analytics, Sentry, rate limits, CORS, legal pages, k6 load test |
| **7** | Buffer + launch: end-to-end bug bash, switch Razorpay/Printrove to live, DNS, one live test order, launch |

---

## 10. Pre-Launch Blockers (non-code)

1. **Printrove catalog mapping** — every `printroveVariantId` must exist and be verified before launch. This is the #1 risk to fulfillment.
2. **GST registration** — if revenue will cross the threshold, register now. Invoice generation ships week 2.
3. **Return/refund policy** — POD limits returns. Draft policy must be live before launch for Razorpay dispute handling.
4. **Design assets** — anime-themed hero imagery, logo, color tokens. If not ready, this is the bottleneck, not the code.
5. **Legal pages** — Terms, Privacy, Shipping, Returns, Contact. Use templates, have a lawyer review post-launch.

---

## 11. Post-Launch (weeks 2–4)

- Abandoned cart email automation (BullMQ + Redis)
- GST-compliant invoice PDF generation
- Returns/RMA flow
- Coupon campaigns + referral program
- Meilisearch for typo-tolerant + faceted search
- Product recommendations ("you may also like")
- Reviews moderation queue
- Instagram shopping tags integration

---

## 12. Open Questions (parked)

- Headless CMS (Sanity/Payload) — revisit if non-technical staff need visual editing.
- Native mobile app — the split backend makes this cheap when ready.
- Loyalty program — consider after 1K orders to understand repeat-buyer behavior.
