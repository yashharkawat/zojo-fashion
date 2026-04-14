#!/usr/bin/env bash
set -euo pipefail

# ─── Zojo Fashion — Local dev setup ──────────────────────
# Run: bash scripts/setup-local.sh
# Requires: Docker, Node 22+, npm

echo "🔧 Starting Postgres..."
docker compose up -d
sleep 2

echo "📦 Installing API dependencies..."
cd apps/api
cp -n .env.example .env 2>/dev/null || true
npm install

echo "🗄  Generating Prisma client + running migrations..."
npx prisma generate --schema=../../prisma/schema.prisma
npx prisma migrate dev --schema=../../prisma/schema.prisma --name init

echo "📦 Installing Web dependencies..."
cd ../web
cp -n .env.example .env 2>/dev/null || true
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the API:   cd apps/api && npm run dev"
echo "Start the web:   cd apps/web && npm run dev"
echo ""
echo "API:  http://localhost:4000/health"
echo "Web:  http://localhost:3000"
