#!/usr/bin/env bash
set -euo pipefail

# ─── Run Prisma migrations against production/staging ────
# Usage: DATABASE_URL="postgresql://..." bash scripts/deploy-db.sh
#
# NEVER run `prisma migrate dev` against production.
# Use `prisma migrate deploy` (applies pending migrations without prompts).

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL not set. Export it first:"
  echo '   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"'
  exit 1
fi

echo "🗄  Checking migration status..."
npx prisma migrate status --schema=prisma/schema.prisma

echo ""
read -p "Apply pending migrations? (y/N) " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo "🚀 Deploying migrations..."
  npx prisma migrate deploy --schema=prisma/schema.prisma
  echo "✅ Done."
else
  echo "Aborted."
fi
