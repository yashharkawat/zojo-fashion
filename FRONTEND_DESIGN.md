# Zojo Fashion — Frontend Architecture

> Next.js 14 App Router • TypeScript (strict) • Tailwind CSS • Redux Toolkit • TanStack Query • Framer Motion
> Dark anime aesthetic, mobile-first, TheSouledStore-inspired layout.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Folder structure](#2-folder-structure)
3. [State management](#3-state-management)
4. [Component hierarchy](#4-component-hierarchy)
5. [Design system & theme](#5-design-system--theme)
6. [Data fetching strategy (RSC vs Client)](#6-data-fetching-strategy-rsc-vs-client)
7. [Routing & layouts](#7-routing--layouts)
8. [Animation strategy](#8-animation-strategy)
9. [Performance budget](#9-performance-budget)
10. [Page-by-page spec](#10-page-by-page-spec)
11. [Build & deploy](#11-build--deploy)

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 14 App Router                       │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │ Server Comp.  │  │ Client Comp.  │  │  Route Handlers  │ │
│  │ - PLP shell   │  │ - Cart        │  │  /api/revalidate │ │
│  │ - PDP shell   │  │ - Checkout    │  │  (ISR purges)    │ │
│  │ - Home        │  │ - Forms       │  │                  │ │
│  └───────┬───────┘  └───────┬───────┘  └──────────────────┘ │
│          │                  │                                │
│          │                  ▼                                │
│          │        ┌─────────────────────┐                    │
│          │        │   Provider Stack    │                    │
│          │        │   (root layout)     │                    │
│          │        │                     │                    │
│          │        │  ReduxProvider      │ — auth, cart, UI   │
│          │        │    └ QueryClient    │ — server state     │
│          │        │       └ ThemeProvider│ — dark only       │
│          │        │          └ Toaster  │                    │
│          │        └─────────────────────┘                    │
│          ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   apps/web/src/                       │    │
│  │   app/      components/   store/   lib/   hooks/      │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │ HTTPS + JWT
                         ▼
              Express API (apps/api)
```

**Key principle:** **Server Components by default**, opt into client components only when the leaf needs interactivity. Catalog pages render fast, ship minimal JS, and the heavy interactive bits (cart, checkout, variant picker) are isolated client islands.

---

## 2. Folder structure

```
apps/web/
├── public/                         # static assets, logo, og images
├── tailwind.config.ts
├── postcss.config.js
├── next.config.mjs
├── tsconfig.json                   # strict
├── .env.example
└── src/
    ├── app/                        # ── App Router (file-system routing)
    │   ├── layout.tsx              # root layout: html, providers, header, footer
    │   ├── page.tsx                # / (Home — server component)
    │   ├── providers.tsx           # client wrapper for RTK + React Query
    │   ├── globals.css             # Tailwind base + CSS vars
    │   ├── error.tsx               # global error boundary
    │   ├── not-found.tsx           # 404
    │   │
    │   ├── (storefront)/           # ── route group (no URL segment)
    │   │   ├── products/
    │   │   │   ├── page.tsx        # PLP — server component, fetches list
    │   │   │   ├── loading.tsx     # skeleton
    │   │   │   └── [slug]/
    │   │   │       ├── page.tsx    # PDP — server component
    │   │   │       └── loading.tsx
    │   │   ├── cart/page.tsx       # client component (reads RTK)
    │   │   ├── checkout/page.tsx   # client (already exists)
    │   │   └── wishlist/page.tsx   # client
    │   │
    │   ├── (account)/              # ── auth-gated routes
    │   │   ├── layout.tsx          # checks auth, redirects to /login
    │   │   ├── orders/
    │   │   │   ├── page.tsx        # client — useQuery
    │   │   │   └── [id]/page.tsx   # tracking page
    │   │   └── profile/page.tsx
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   │
    │   └── admin/                  # ── admin section (own layout)
    │       ├── layout.tsx          # gate by role=ADMIN
    │       ├── page.tsx            # dashboard (analytics)
    │       ├── products/page.tsx
    │       ├── orders/page.tsx
    │       └── analytics/page.tsx
    │
    ├── components/                 # ── reusable across pages
    │   ├── ui/                     # design-system primitives (shadcn-style)
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   ├── Select.tsx
    │   │   ├── Badge.tsx
    │   │   ├── Skeleton.tsx
    │   │   ├── Drawer.tsx
    │   │   ├── Modal.tsx
    │   │   └── Toast.tsx
    │   │
    │   ├── layout/
    │   │   ├── Header.tsx          # logo, nav, search, cart icon, account
    │   │   ├── MobileNav.tsx       # bottom tab bar (mobile)
    │   │   ├── Footer.tsx
    │   │   └── Breadcrumbs.tsx
    │   │
    │   ├── product/
    │   │   ├── ProductCard.tsx     # PLP grid item
    │   │   ├── ProductGrid.tsx
    │   │   ├── ProductFilters.tsx  # category, anime series, size, color, price
    │   │   ├── ProductGallery.tsx  # PDP image carousel
    │   │   ├── VariantPicker.tsx   # size + color swatches
    │   │   ├── SizeGuide.tsx       # modal
    │   │   ├── PriceTag.tsx
    │   │   ├── PincodeChecker.tsx  # PDP serviceability
    │   │   └── AddToCartButton.tsx
    │   │
    │   ├── home/
    │   │   ├── HeroCarousel.tsx    # rotating banners (CMS-driven)
    │   │   ├── FeaturedCollections.tsx
    │   │   ├── AnimeSeriesGrid.tsx # Naruto, AOT, etc. tile grid
    │   │   ├── BestSellers.tsx
    │   │   └── InstagramFeed.tsx
    │   │
    │   ├── cart/
    │   │   ├── CartDrawer.tsx      # slide-out from right
    │   │   ├── CartLineItem.tsx
    │   │   ├── CartSummary.tsx
    │   │   ├── CouponInput.tsx
    │   │   └── EmptyCart.tsx
    │   │
    │   ├── checkout/
    │   │   ├── CheckoutButton.tsx  # exists
    │   │   ├── AddressSelector.tsx
    │   │   └── OrderSummary.tsx
    │   │
    │   ├── order/
    │   │   ├── OrderCard.tsx       # row in /orders list
    │   │   ├── OrderTimeline.tsx   # PENDING → CONFIRMED → ... → DELIVERED
    │   │   └── TrackingMap.tsx     # courier + AWB display
    │   │
    │   ├── admin/
    │   │   ├── DashboardStats.tsx
    │   │   ├── OrdersTable.tsx
    │   │   ├── ProductsTable.tsx
    │   │   └── StatusBadge.tsx
    │   │
    │   └── motion/
    │       ├── PageTransition.tsx  # fade + slight Y on route change
    │       ├── FadeIn.tsx          # IntersectionObserver-driven reveal
    │       └── StaggerChildren.tsx
    │
    ├── store/                      # ── Redux Toolkit
    │   ├── index.ts                # configureStore + RootState type
    │   ├── hooks.ts                # typed useAppDispatch / useAppSelector
    │   └── slices/
    │       ├── authSlice.ts        # accessToken, user, hydration
    │       ├── cartSlice.ts        # guest cart (persisted localStorage)
    │       └── uiSlice.ts          # cartDrawerOpen, mobileNavOpen, toasts
    │
    ├── features/                   # ── feature-specific data hooks (RTK Query OR React Query)
    │   ├── products/
    │   │   ├── useProducts.ts      # useQuery wrapper with filters
    │   │   └── useProduct.ts       # by slug
    │   ├── orders/
    │   │   ├── useMyOrders.ts
    │   │   └── useOrder.ts
    │   ├── wishlist/
    │   │   ├── useWishlist.ts
    │   │   ├── useAddToWishlist.ts
    │   │   └── useRemoveFromWishlist.ts
    │   └── auth/
    │       ├── useLogin.ts
    │       └── useRegister.ts
    │
    ├── lib/
    │   ├── api.ts                  # exists — typed fetch wrapper
    │   ├── query-client.ts         # QueryClient factory
    │   ├── format.ts               # inr(), date, plural
    │   ├── cn.ts                   # clsx wrapper
    │   └── analytics.ts            # PostHog + GA wrappers
    │
    ├── hooks/
    │   ├── useRazorpayScript.ts    # exists
    │   ├── useAuth.ts              # selectors + actions
    │   ├── useCart.ts              # cart logic + persistence
    │   ├── useDebounce.ts
    │   ├── useMediaQuery.ts        # mobile detection
    │   └── useIntersection.ts      # for scroll-reveal
    │
    └── types/
        ├── api.ts                  # exists
        ├── razorpay.ts             # exists
        ├── product.ts              # mirror of API shape
        └── order.ts
```

---

## 3. State management

Three layers, each with a clear responsibility. **Don't mix them.**

```
┌──────────────────────────────────────────────────────────────┐
│   Server state              │   Client state                  │
│   (TanStack Query)          │   (Redux Toolkit)               │
│   ─────────────────         │   ───────────────────           │
│                             │                                 │
│   • Products list/detail    │   • auth (token, user)          │
│   • Orders list/detail      │   • cart (guest items)          │
│   • Wishlist                │   • UI (drawer, modals, toasts) │
│   • Categories              │                                 │
│   • Admin queries           │   Persisted: auth + cart        │
│                             │   to localStorage on changes    │
│   Cached, retried,          │                                 │
│   refetched on focus        │   Synchronous, instant updates  │
└──────────────────────────────────────────────────────────────┘

URL state (Next.js searchParams)
────────────────────────────────
• Filters: ?category=tees&anime=Naruto&size=L&sort=-price
• Pagination: ?page=2
• Single source of truth for "what page is showing"
```

### Why this split?

- **TanStack Query** owns *server-derived* data — caching, refetching, optimistic updates, and dedup are its bread and butter. Putting orders/products in Redux means you re-implement all of that.
- **Redux Toolkit** owns *truly client-side* state — what's in the cart before login, whether the drawer is open, the access token. Things that don't have a "fetch from server" semantic.
- **URL** owns *navigable filter/pagination state* — so the Back button works, and a PLP URL is shareable.

### Redux store layout

```typescript
// store/index.ts
export interface RootState {
  auth: {
    accessToken: string | null;
    user: PublicUser | null;
    status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
  };
  cart: {
    items: CartLine[];        // guest cart; merged into server cart on login
    couponCode: string | null;
    lastModified: number;
  };
  ui: {
    cartDrawerOpen: boolean;
    mobileNavOpen: boolean;
    searchOpen: boolean;
    toasts: Toast[];
  };
}
```

### Persistence
- `auth` slice: `accessToken` only; user object refetched on hydrate via `/auth/me`
- `cart` slice: full items array; merged into server cart on login via `POST /cart/merge`
- Use `redux-persist` whitelist or a simpler manual subscribe-and-store

### React Query setup
```typescript
// lib/query-client.ts
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,           // 1 min — most catalog data is stable
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,    // anime fans don't want jitter
        retry: (count, err) => count < 2 && !(err as any)?.status?.toString().startsWith('4'),
      },
    },
  });
}
```

### Query key conventions
```
['products', { category, anime, size, sort, page }]
['product', slug]
['orders', 'my', { page }]
['order', id]
['wishlist']
['admin', 'orders', filters]
```

Hierarchical so we can `queryClient.invalidateQueries({ queryKey: ['orders'] })` after a refund.

---

## 4. Component hierarchy

### Root tree (every page)
```
<RootLayout>                              ← app/layout.tsx (server)
  <Providers>                             ← client wrapper
    <ReduxProvider store={store}>
      <QueryClientProvider client={qc}>
        <Toaster />
        <Header />                        ← client (cart count, account)
        <main>{children}</main>           ← page slot
        <Footer />                        ← server
        <MobileNav />                     ← client (md:hidden)
        <CartDrawer />                    ← portal, client
      </QueryClientProvider>
    </ReduxProvider>
  </Providers>
</RootLayout>
```

### Home page tree
```
HomePage (server)
├── HeroCarousel (client — Embla + Framer)
│   └── HeroSlide × N
├── AnimeSeriesGrid (server — fetches collections at request time)
│   └── CollectionTile × N (link to /products?anime=Naruto)
├── FeaturedCollections (server)
│   └── CollectionRow
│       └── ProductCard × N
├── BestSellers (server)
│   └── ProductCard × 8
└── InstagramFeed (client — Suspense)
    └── InstaTile × 6
```

### PLP tree
```
ProductsPage (server)
├── PageHeader (server) — category title + count
├── <FilterRail />            ← client; reads/writes URL searchParams
│   ├── CategoryFilter
│   ├── AnimeSeriesFilter
│   ├── SizeFilter
│   ├── ColorFilter
│   ├── PriceRange
│   └── SortSelect
└── <ProductGrid />           ← server; receives parsed filters
    ├── Suspense fallback={<ProductGridSkeleton />}
    └── ProductCard × N
        └── WishlistHeartButton (client island)
        └── QuickAddButton (client)
```

### PDP tree
```
ProductPage (server) — fetches product by slug
├── Breadcrumbs
├── <ProductGallery />         ← client — Embla carousel + zoom
├── ProductInfo (server)
│   ├── Title, brand, price (PriceTag)
│   ├── ReviewSummary (server)
│   ├── <VariantPicker />     ← client — size + color, drives URL ?v=variantId
│   ├── <PincodeChecker />    ← client — calls /products/serviceability
│   ├── <AddToCartButton />   ← client — dispatches RTK action
│   ├── <SizeGuide />         ← client — modal
│   └── ProductMeta — material, care
├── DescriptionTabs (client — accordion)
└── RelatedProducts (server)
    └── ProductGrid
```

### Cart tree (drawer + page)
```
CartDrawer (client, portal, fixed right)
├── CartHeader — "Your Cart (3)"
├── <CartLines>
│   └── CartLineItem × N
│       ├── Image
│       ├── Title + variant
│       ├── QuantityStepper
│       └── RemoveButton
├── CouponInput
├── CartSummary — subtotal, shipping, tax
└── CheckoutCta — Link to /checkout
```

---

## 5. Design system & theme

### Colors (CSS custom properties)
```css
:root {
  /* Anime palette — neon accents on near-black */
  --bg-base:      #0A0A0A;        /* page background */
  --bg-elevated:  #141414;        /* cards, inputs */
  --bg-overlay:   #1F1F1F;        /* hover, secondary */
  --bg-border:    #2A2A2A;

  --fg-primary:   #F5F5F5;        /* main text */
  --fg-secondary: #A3A3A3;        /* meta, captions */
  --fg-muted:     #6B6B6B;

  --accent:       #A855F7;        /* neon purple — CTA */
  --accent-hover: #C084FC;
  --accent-glow:  rgba(168,85,247,.35);

  --pink:         #EC4899;        /* secondary accent — sale tags */
  --cyan:         #22D3EE;        /* highlights */
  --success:      #10B981;
  --warn:         #F59E0B;
  --danger:       #EF4444;
}
```

### Typography
- **Display**: `Bebas Neue` or `Cabinet Grotesk` — punchy headlines
- **Body**: `Inter` — readable, ships on Google Fonts
- **Accent**: `JetBrains Mono` for prices, codes (slight tech feel)

### Spacing scale
Standard Tailwind 4-px grid. Stick to it; no arbitrary values in components.

### Radii
- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-lg` (8px)
- Pills/badges: `rounded-full`

### Shadows
- Avoid soft shadows on dark theme — use **glows** instead:
  ```css
  box-shadow: 0 0 24px var(--accent-glow);
  ```

### Tailwind config
See `apps/web/tailwind.config.ts` for the bound configuration of these tokens.

---

## 6. Data fetching strategy (RSC vs Client)

| Page/component | Strategy | Why |
|---|---|---|
| Home (collections, banners) | **Server component**, ISR `revalidate: 60` | SEO, fast TTFB, cacheable |
| PLP grid | **Server component**, fetches with searchParams | SEO, deep-linkable filters |
| PLP filter rail | Client | Reads/writes URL searchParams |
| PDP shell | **Server component** | SEO, OG tags |
| PDP variant picker, gallery | Client island | Interactivity |
| Cart | Client (Redux source) | Persisted, instant |
| Wishlist | Client + React Query | Per-user, mutates frequently |
| Orders list | Client + React Query | Per-user, requires auth |
| Order tracking | Client + React Query, refetch every 30s if SHIPPED | Live updates |
| Admin | Client + React Query | Heavy interactivity, no SEO |

### Pattern: server fetch with explicit cache hints
```typescript
// app/products/page.tsx (server)
import { listProducts } from '@/lib/api-server';

export default async function ProductsPage({ searchParams }: { searchParams: ProductsQuery }) {
  const data = await listProducts(searchParams);   // no React Query — server side
  return <ProductGrid initialData={data} />;
}
```

Client `ProductGrid` can then use `useQuery` with the same key, hydrated from `initialData`, so navigation between filter changes uses the client cache without re-rendering server.

---

## 7. Routing & layouts

### Route groups (App Router)
- `(storefront)` — public storefront pages, common header/footer
- `(account)` — requires auth; layout redirects to `/login` if no token
- `(auth)` — login/register; lighter layout (no main nav)
- `admin` — own layout, role-gated, separate styling chrome

### Auth gate (middleware.ts)
```typescript
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/orders', '/profile', '/wishlist', '/checkout'];
const ADMIN = ['/admin'];

export function middleware(req: NextRequest) {
  const token = req.cookies.get('rt')?.value; // refresh cookie presence as a proxy
  const path = req.nextUrl.pathname;

  if (PROTECTED.some((p) => path.startsWith(p)) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  // Admin role check happens client-side — middleware can't decode JWT cheaply
  return NextResponse.next();
}

export const config = {
  matcher: ['/orders/:path*', '/profile', '/wishlist', '/checkout', '/admin/:path*'],
};
```

### Loading & Error boundaries
Every server-data route ships a `loading.tsx` skeleton and an `error.tsx` recovery view.

---

## 8. Animation strategy

**Principles:**
- Fast, subtle, optional. No 800ms entrances on PLP cards.
- All animations respect `prefers-reduced-motion` (Framer Motion does this automatically with `useReducedMotion`).
- Layout animations (`layoutId`) for hero → PDP and cart drawer slide. Cheap, GPU-friendly.

**Where to use:**
| Surface | Animation |
|---|---|
| Page transition | Fade + 8px Y, 200ms |
| Hero carousel | Embla autoplay 6s, manual swipe |
| Add to cart | Cart icon shake + count bump (spring) |
| Cart drawer | Slide from right, 250ms ease-out |
| Modal/Drawer | Fade backdrop + slide content |
| ProductCard hover (desktop) | Image scale 1.04, 300ms |
| Scroll reveal | FadeIn intersection-observer, 1× per element |
| Variant swatch select | Border-color spring |
| Wishlist heart | Bounce on add |

**Don't:**
- Animate `width`/`height` (use `scale` or `clip-path`)
- Stagger more than 6 items
- Use AnimatePresence on lists (causes layout thrash)

```tsx
// components/motion/PageTransition.tsx
'use client';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

---

## 9. Performance budget

| Metric | Target | Tactic |
|---|---|---|
| LCP (PLP) | < 2.0s | ISR cache, optimized hero, font-display: swap |
| LCP (PDP) | < 2.2s | First image priority, blur placeholder |
| TTI | < 3.5s | RSC where possible, route-level code splitting |
| JS shipped (initial) | < 120 KB gz | RSC, no top-level imports of admin code |
| CLS | < 0.05 | Reserve image aspect, font preload |
| Image weight | < 200 KB per LCP image | Cloudinary `f_auto,q_auto`, AVIF/WebP |

**Implementation notes:**
- Use `<Image priority />` only on the LCP element (hero, first PDP image)
- Lazy-load Razorpay script (already done via `useRazorpayScript`)
- `next/dynamic` for admin tables, code editors, anything > 20KB
- Avoid client components in `app/layout.tsx` other than the providers wrapper

---

## 10. Page-by-page spec

### `/` Home
- **Hero**: rotating banner carousel (3 slides), full-bleed, CTA button
- **Anime series tile grid**: 6 tiles (Naruto, AOT, One Piece, etc.) → links to `?anime=...`
- **Featured collections**: 2 horizontal scrollers
- **Best sellers**: 8 product cards
- **Instagram embed**: 6 latest posts (cached 1h server-side)
- **Newsletter strip** (week 2)

### `/products` PLP
- **Filter rail** (left desktop, drawer on mobile)
- **Sort dropdown** top-right
- **Grid**: 2-col mobile, 3-col tablet, 4-col desktop
- **Pagination**: numbered, URL `?page=`
- Filters drive URL; URL drives query

### `/products/[slug]` PDP
- **Above the fold**: gallery (left), info column (right)
- Variant picker, pincode checker, add to cart, wishlist heart
- **Tabs**: Description, Material, Size guide, Reviews
- **You may also like**: 4 related products

### `/cart`
- Full-page version of the drawer for users who want a quieter view
- Coupon input, totals, "Proceed to Checkout" CTA
- Empty state with link to `/products`

### `/checkout`
- Step 1: Shipping address (select existing or add)
- Step 2: Payment method (Razorpay or COD) → `<CheckoutButton>`
- Order summary sticky on right (desktop)

### `/orders`
- Card per order with status badge, primary item image, total, date
- Click → `/orders/:id`

### `/orders/[id]`
- Status timeline (PENDING → ... → DELIVERED) with checkpoints
- Tracking widget if SHIPPED (courier, AWB, link)
- Items table
- "Cancel order" if eligible

### `/wishlist`
- Grid of saved products (reuses `<ProductCard>`)
- Empty state with anime-themed copy

### `/profile`
- Tabbed: Personal info | Addresses | Password | Notifications

### `/admin`
- Dashboard with revenue, orders, top products (last 30 days)
- Sub-routes: `/admin/products`, `/admin/orders`, `/admin/analytics`
- Role-gated: redirect non-admins on mount

---

## 11. Build & deploy

### Vercel
- Project: `apps/web`
- Build command: `next build`
- Output: `.next`
- Env: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_SITE_URL`
- Edge regions: `bom1` (Mumbai) primary

### Image domains
`next.config.mjs`:
```javascript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'res.cloudinary.com' },
    { protocol: 'https', hostname: 'images.zojofashion.com' },
  ],
}
```

### Bundle analysis
`@next/bundle-analyzer` — gate at 120KB initial JS in CI.

### Lighthouse CI
Run on every PR; fail if performance score < 85 on mobile.

---

## Files added/scaffolded in this phase

```
apps/web/
├── tailwind.config.ts          ★ design tokens
├── postcss.config.js
├── next.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx          ★ root layout + providers
│   │   ├── providers.tsx       ★ RTK + RQ wrapper
│   │   ├── globals.css         ★ tokens + base
│   │   ├── page.tsx            ★ home (RSC)
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── products/page.tsx   ★ PLP (RSC)
│   │   ├── products/[slug]/page.tsx ★ PDP (RSC)
│   │   ├── cart/page.tsx       ★ cart
│   │   ├── wishlist/page.tsx   ★ wishlist
│   │   ├── orders/page.tsx     ★ orders list
│   │   ├── profile/page.tsx    skeleton
│   │   └── admin/page.tsx      skeleton
│   ├── components/
│   │   ├── ui/Button.tsx       ★
│   │   ├── ui/Skeleton.tsx     ★
│   │   ├── layout/Header.tsx   ★
│   │   ├── layout/Footer.tsx   ★
│   │   ├── product/ProductCard.tsx ★
│   │   ├── home/Hero.tsx       ★
│   │   └── motion/PageTransition.tsx ★
│   ├── store/
│   │   ├── index.ts            ★ configureStore
│   │   ├── hooks.ts            ★ typed hooks
│   │   └── slices/{auth,cart,ui}Slice.ts ★
│   ├── lib/
│   │   ├── query-client.ts     ★
│   │   ├── format.ts           ★
│   │   └── cn.ts               ★
│   └── hooks/
│       ├── useAuth.ts          ★
│       └── useCart.ts          ★
```

Pages marked `skeleton` are wired-up routes with stub content — fill in next.
