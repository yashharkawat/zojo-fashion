# Zojo Fashion

Anime/otaku-themed premium men's clothing brand — India-first, print-on-demand via Printrove.

## Documentation
- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** — product scope, architecture, ADRs, 1-week delivery plan
- **[API_DESIGN.md](./API_DESIGN.md)** — complete REST API specification
- **[RAZORPAY_INTEGRATION.md](./RAZORPAY_INTEGRATION.md)** — Razorpay + COD flow, webhooks, refunds, receipts
- **[PRINTROVE_INTEGRATION.md](./PRINTROVE_INTEGRATION.md)** — POD fulfillment, status mapping, webhook, notifications
- **[FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md)** — Next.js architecture, state split, components, design tokens
- **[AUTH_SYSTEM.md](./AUTH_SYSTEM.md)** — email/password + phone OTP, JWT + refresh rotation, security
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Vercel + Render + Neon, CI/CD, monitoring, deploy checklist
- **[apps/api/README.md](./apps/api/README.md)** — backend quick-start + endpoint cheat sheet

## Quick start

```bash
# One-shot local setup (Docker + Node 22 required)
bash scripts/setup-local.sh

# Or manually:
docker compose up -d                     # Postgres
cd apps/api && npm i && npm run dev      # API on :4000
cd apps/web && npm i && npm run dev      # Web on :3000
```

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Frontend | Next.js 14, TypeScript, Tailwind, Redux Toolkit, React Query, Framer Motion | Vercel |
| Backend | Express, TypeScript (strict), Prisma ORM | Render |
| Database | PostgreSQL 16, pgBouncer | Neon / Supabase |
| Payments | Razorpay (UPI, cards, NB, wallets, COD) | — |
| Fulfillment | Printrove (print-on-demand) | — |
| Images | Cloudinary (AVIF/WebP via CDN) | — |
| Auth | JWT + refresh rotation, Phone OTP, argon2id | — |
| CI/CD | GitHub Actions (typecheck + lint on PR, deploy on merge) | GitHub |
| Monitoring | Sentry (errors), PostHog (analytics), BetterStack (uptime) | — |

## Structure

```
zojo-fashion/
├── .github/workflows/
│   ├── ci.yml                    # PR checks: typecheck + lint + schema
│   └── deploy.yml                # Main push: trigger Render deploy
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
