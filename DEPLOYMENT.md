# Zojo Fashion — Deployment Guide

> Vercel (frontend) + Render (backend) + Neon/Supabase (Postgres)
> GitHub: `yashharkawat/zojo-fashion` (personal account)

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Git + GitHub setup](#3-git--github-setup)
4. [Database (Neon / Supabase)](#4-database)
5. [Backend — Render](#5-backend--render)
6. [Frontend — Vercel](#6-frontend--vercel)
7. [CI/CD — GitHub Actions](#7-cicd--github-actions)
8. [Monitoring](#8-monitoring)
9. [Local dev (Docker Compose)](#9-local-dev)
10. [Environment separation](#10-environment-separation)
11. [Deploy checklist](#11-deploy-checklist)
12. [Rollback procedure](#12-rollback-procedure)

---

## 1. Architecture overview

```
GitHub (yashharkawat/zojo-fashion)
  │
  ├─ push to main → GitHub Actions CI
  │    ├─ typecheck + lint + test
  │    ├─ (apps/api changed?) → Render auto-deploys
  │    └─ (apps/web changed?) → Vercel auto-deploys
  │
  ├─ PR opened → Actions run checks; Vercel preview deploy
  │
  ▼
┌────────────────────────────────────────────────────────────┐
│                     Production                              │
│                                                            │
│  Vercel (bom1)          Render (Singapore)    Neon / Supabase
│  apps/web               apps/api              PostgreSQL 16
│  Next.js 14 SSR         Express + TS          pgBouncer
│  Edge middleware         Prisma                PITR backups
│  Image CDN (AVIF)       Health: /health       Connection pool
│                                                            │
│  ──── zojofashion.com   api.zojofashion.com               │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

Account checklist:

- [ ] GitHub: `yashharkawat` (personal)
- [ ] Vercel: linked to GitHub
- [ ] Render: linked to GitHub
- [ ] Neon (or Supabase) — Postgres provider
- [ ] Cloudinary — image CDN
- [ ] Razorpay — payment gateway (test + live keys)
- [ ] Resend — transactional email (optional, stubbed in dev)
- [ ] MSG91 — SMS OTP (optional, logged in dev)
- [ ] Sentry — error tracking (free tier)
- [ ] PostHog — product analytics (free tier)

---

## 3. Git + GitHub setup

```bash
cd /Users/yashharkawat/Desktop/personal_projects/zojo-fashion

# Init git repo
git init
git add -A
git commit -m "Initial project scaffold"

# Create GitHub repo (use gh CLI or web UI)
gh repo create yashharkawat/zojo-fashion --private --source=. --remote=origin

# Or if using SSH host alias (like fnf project):
git remote add origin git@github.com:yashharkawat/zojo-fashion.git

# Push
git push -u origin main
```

---

## 4. Database

### Option A: Neon (recommended for serverless)

1. Create project at neon.tech → region: `ap-south-1` (Mumbai)
2. Copy connection strings from dashboard:
   - **Pooled**: `postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/zojo?sslmode=require` (for app)
   - **Direct**: `postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/zojo?sslmode=require` (for migrations)
3. Neon auto-enables pgBouncer on pooled connections
4. Point-in-time recovery included on paid plans

### Option B: Supabase (like your fnf project)

1. Create project at supabase.com → region: Mumbai
2. Dashboard → Settings → Database:
   - **Connection pooler URL** (port 6543 + `?pgbouncer=true`)
   - **Direct URL** (port 5432)
3. Enable Row Level Security if needed

### Run migrations

```bash
cd apps/api
echo "DATABASE_URL=<pooled_url>" >> .env
echo "DIRECT_URL=<direct_url>" >> .env
npx prisma migrate deploy --schema=../../prisma/schema.prisma
```

---

## 5. Backend — Render

`render.yaml` is the Render Blueprint (Infrastructure-as-Code). Push it to the
repo root; Render reads it on connect.

### Connect to Render

1. Dashboard → New → Blueprint
2. Connect `yashharkawat/zojo-fashion` repo
3. Render detects `render.yaml`, provisions the service
4. Fill in env vars marked `sync: false` through the dashboard

### Health check

Render pings `GET /health` every 30s. The app returns `{ status: 'ok', uptime: ... }`.

### Custom domain

Dashboard → Service → Settings → Custom Domain → `api.zojofashion.com`
DNS: `CNAME api.zojofashion.com → <service>.onrender.com`

---

## 6. Frontend — Vercel

### Connect

1. vercel.com → Import → `yashharkawat/zojo-fashion`
2. Framework: Next.js (auto-detected)
3. Root directory: `apps/web`
4. Build command: `npm run build` (Vercel runs this inside `apps/web`)
5. Output: `.next`

### Environment variables (Vercel dashboard)

```
NEXT_PUBLIC_API_BASE_URL     = https://api.zojofashion.com/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID  = rzp_live_xxxxx
NEXT_PUBLIC_SITE_URL         = https://zojofashion.com
NEXT_PUBLIC_POSTHOG_KEY      = phc_xxxxx
NEXT_PUBLIC_SENTRY_DSN       = https://xxx@sentry.io/xxx
```

### Custom domain

Project Settings → Domains → Add `zojofashion.com` + `www.zojofashion.com`
DNS: per Vercel instructions (A record or CNAME)

### Edge middleware

`apps/web/src/middleware.ts` runs at the edge — auth redirects happen in < 5ms
at `bom1` (Mumbai). No config needed; Vercel auto-detects the file.

### Image optimization

Already configured in `next.config.mjs`:
```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'res.cloudinary.com' },
  ],
  formats: ['image/avif', 'image/webp'],
}
```
Vercel's image optimizer serves AVIF/WebP at the edge. No extra setup.

---

## 7. CI/CD — GitHub Actions

**`ci.yml`** runs on PRs and pushes to `main`: `api-check` (Prisma generate + typecheck) and `web-check` (typecheck), then **`OK to deploy (all checks passed)`** if both succeed. Nothing else is required for Vercel or Railway to build from GitHub—those platforms auto-deploy on push *when* you allow it. If you use **“wait for CI”** (Railway) or branch protection, point the required check at the **CI** workflow (or the `OK to deploy` job), not a separate empty workflow.

---

## 8. Monitoring

### Sentry (error tracking)

- Backend: `@sentry/node` — init in `server.ts`
- Frontend: `@sentry/nextjs` — auto-wraps pages, API routes
- Free tier: 5K events/month

### PostHog (product analytics)

- Track: page views, add-to-cart, checkout start, payment success
- Session recordings: 15K/month free

### Uptime (BetterStack / UptimeRobot)

- Monitor `https://api.zojofashion.com/health` — HTTP 200 check every 60s
- Monitor `https://zojofashion.com` — every 60s
- Alert: Slack / email on 2 consecutive failures

---

## 9. Local dev

`docker-compose.yml` spins up a local Postgres for dev (same as your fnf project pattern).

```bash
docker compose up -d        # start Postgres
cd apps/api
cp .env.example .env        # edit DATABASE_URL to localhost
npm run prisma:migrate
npm run dev                  # Express on :4000

# In another terminal:
cd apps/web
cp .env.example .env
npm run dev                  # Next.js on :3000
```

---

## 10. Environment separation

| Env | API | Frontend | Database | Payments |
|-----|-----|----------|----------|----------|
| **dev** | localhost:4000 | localhost:3000 | Docker Postgres | Razorpay test |
| **preview** | Render preview (PR branch) | Vercel preview | Neon dev branch | Razorpay test |
| **production** | api.zojofashion.com | zojofashion.com | Neon main | Razorpay live |

Neon supports database branching — create a dev branch per PR for isolated schema testing.

---

## 11. Deploy checklist

### First deploy

- [ ] Git repo pushed to `yashharkawat/zojo-fashion`
- [ ] Neon/Supabase project created, connection strings copied
- [ ] `prisma migrate deploy` run against production DB
- [ ] Render Blueprint connected, env vars filled
- [ ] Render `/health` returns 200
- [ ] Vercel project connected, env vars set
- [ ] DNS configured: `zojofashion.com`, `api.zojofashion.com`
- [ ] SSL green on both domains
- [ ] Razorpay live keys set (both backend + frontend)
- [ ] Razorpay webhook URL registered: `https://api.zojofashion.com/api/v1/payments/webhook`
- [ ] Sentry DSN set in both apps
- [ ] Uptime monitor created
- [ ] One test order placed end-to-end

### Every deploy

- [ ] `npm run typecheck` passes (CI enforces this)
- [ ] No pending migrations (`prisma migrate status`)
- [ ] Env vars unchanged (or updated in dashboard)
- [ ] **Backend actually shipped the current API**: `curl -sS "https://<api-host>/api/v1/cart"` (no cookies) should return **401** `UNAUTHORIZED` (or your auth error), **not 404** `Route GET /api/v1/cart not found`. A 404 on `/api/v1/cart/*` means the running server is an old build: push latest `main`, then on Render use **Clear build cache & deploy**, and confirm `GET /health` includes a new `commit` (short git SHA) after deploy.
- [ ] `CORS_ALLOWED_ORIGINS` on the API includes your real storefront origin (for example `https://zojo-fashion.yashharkawat.com` if you use that domain), comma-separated, no trailing slashes.
- [ ] Quick smoke test: home → PDP → add to cart → checkout → cancel

---

## 12. Rollback procedure

### Backend (Render)

Dashboard → Service → Deploys → click previous deploy → "Rollback to this deploy"

### Frontend (Vercel)

Dashboard → Project → Deployments → click previous → "Promote to Production"

### Database

Neon: PITR → restore to timestamp before the bad migration.
Supabase: Dashboard → Database → Backups → restore.

Never `prisma migrate reset` in production. If a migration is bad, write a new
counter-migration and deploy forward.
