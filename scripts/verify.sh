#!/usr/bin/env bash
set -euo pipefail

# ─── Pre-push verification ───────────────────────────────
# Runs the exact same checks as CI + Railway build.
# MUST pass before any git push.
#
# Usage: bash scripts/verify.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FAIL=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "════════════════════════════════════════════"
echo "  Pre-push verification"
echo "════════════════════════════════════════════"
echo ""

# 1. API typecheck
echo -n "[1/4] API typecheck ... "
cd "$ROOT/apps/api"
if npx tsc --noEmit 2>&1 > /dev/null; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  npx tsc --noEmit 2>&1 | head -20
  FAIL=1
fi

# 2. API build (same as Railway runs)
echo -n "[2/4] API build     ... "
cd "$ROOT/apps/api"
rm -rf dist
if npm run build 2>&1 > /dev/null; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  npm run build 2>&1 | tail -20
  FAIL=1
fi

# 3. Web typecheck
echo -n "[3/4] Web typecheck ... "
cd "$ROOT/apps/web"
if npx tsc --noEmit 2>&1 > /dev/null; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  npx tsc --noEmit 2>&1 | head -20
  FAIL=1
fi

# 4. Prisma schema valid
echo -n "[4/4] Prisma schema ... "
cd "$ROOT/apps/api"
if npx prisma validate --schema=../../prisma/schema.prisma 2>&1 > /dev/null; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  FAIL=1
fi

echo ""
echo "════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED — safe to push${NC}"
else
  echo -e "  ${RED}CHECKS FAILED — do NOT push${NC}"
fi
echo "════════════════════════════════════════════"
echo ""

exit $FAIL
