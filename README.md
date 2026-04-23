# Zojo Fashion

Anime/otaku-themed premium men's clothing brand — India-first e-commerce.

## Documentation
- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** — product scope, architecture, ADRs, 1-week delivery plan
- **[API_DESIGN.md](./API_DESIGN.md)** — complete REST API specification
- **[RAZORPAY_INTEGRATION.md](./RAZORPAY_INTEGRATION.md)** — Razorpay + COD flow, webhooks, refunds, receipts
- **[FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md)** — Next.js architecture, state split, components, design tokens
- **[AUTH_SYSTEM.md](./AUTH_SYSTEM.md)** — email/password + phone OTP, JWT + refresh rotation, security
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Vercel + Render + Neon, CI/CD, monitoring, deploy checklist
- **[apps/api/README.md](./apps/api/README.md)** — backend quick-start + endpoint cheat sheet

## How to start locally

**Prerequisites:** [Node.js 22+](https://nodejs.org/) and npm, [Docker](https://www.docker.com/) (only if you use the bundled Postgres; skip if you point the API at a cloud DB such as Neon).

### 1. Environment files

- **API** — from the repo root:
  ```bash
  cp apps/api/.env.example apps/api/.env
  ```
  Edit `apps/api/.env` and set at least `DATABASE_URL` (and `DIRECT_URL` if your Prisma flow uses it). You can use **either** a hosted PostgreSQL URL **or** local Docker Postgres (see step 2).
- **Web** — required; the app will not start without `NEXT_PUBLIC_API_BASE_URL`:
  ```bash
  cp apps/web/.env.example apps/web/.env
  ```
  Defaults in `.env.example` target `http://localhost:4000/api/v1` and `http://localhost:3000`; adjust if your ports differ.

### 2. Database (choose one)

- **Docker (local Postgres 16):** from the repo root, `docker compose up -d`, then put the matching `DATABASE_URL` in `apps/api/.env` (user/password/db from [`docker-compose.yml`](./docker-compose.yml)).
- **Remote Postgres:** put your connection string in `apps/api/.env` and skip Docker.

### 3. One-shot install (recommended)

From the repo root. Uses Docker for Postgres, installs both apps, runs Prisma generate and migrations, and creates `.env` from examples if missing (without overwriting existing files).

```bash
bash scripts/setup-local.sh
```

### 4. Run the two apps

Use **two terminals** (API first is a good habit so the web client can call it immediately).

**Terminal A — API (port 4000)**

```bash
cd apps/api
npm install
npx prisma generate --schema=../../prisma/schema.prisma   # if you did not run setup-local.sh
npm run dev
```

- Health check: [http://localhost:4000/health](http://localhost:4000/health)

**Terminal B — Web (port 3000)**

```bash
cd apps/web
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)

### Manual path without `setup-local.sh`

If you already manage `.env` and the database yourself:

```bash
docker compose up -d   # only when using local Postgres
cd apps/api && npm install && npx prisma generate --schema=../../prisma/schema.prisma && npx prisma migrate dev --schema=../../prisma/schema.prisma
cd apps/web && npm install && cp -n .env.example .env
```

Then run `npm run dev` in `apps/api` and `apps/web` as in step 4.

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Frontend | Next.js 14, TypeScript, Tailwind, Redux Toolkit, React Query, Framer Motion | Vercel |
| Backend | Express, TypeScript (strict), Prisma ORM | Render |
| Database | PostgreSQL 16, pgBouncer | Neon / Supabase |
| Payments | Razorpay (UPI, cards, NB, wallets, COD) | — |
| Images | Cloudinary (AVIF/WebP via CDN) | — |
| Auth | JWT + refresh rotation, Phone OTP, argon2id | — |
| CI/CD | GitHub Actions (typecheck + lint on PR, deploy on merge) | GitHub |
| Monitoring | Sentry (errors), PostHog (analytics), BetterStack (uptime) | — |

## Structure

```
zojo-fashion/
├── .github/workflows/
│   └── ci.yml                    # API + web typecheck; optional “OK to deploy” gate
├── prisma/
│   └── schema.prisma             # 15+ models, India-specific
├── apps/
│   ├── api/                      # Express + TS backend (24+ endpoints)
│   └── web/                      # Next.js 14 frontend (10+ pages)
├── scripts/
│   ├── setup-local.sh            # One-shot local env setup
│   └── deploy-db.sh              # Production migration runner
├── render.yaml                   # Render IaC blueprint
├── docker-compose.yml            # Local Postgres
└── 7 design docs (*.md)
```

## Deploy

```bash
# First time
gh repo create yashharkawat/zojo-fashion --private --source=. --remote=origin
git push -u origin main

# Render picks up render.yaml automatically
# Vercel picks up apps/web automatically
# GitHub Actions run on every PR and merge

# DB migrations (production)
DATABASE_URL="postgresql://..." bash scripts/deploy-db.sh
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete guide.
