FROM node:22-alpine AS builder

# OpenSSL needed for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy prisma schema first (needed for generate)
COPY prisma/ ./prisma/

# Copy api package files and install
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci --include=dev

# Generate Prisma client
RUN npx prisma generate --schema=../../prisma/schema.prisma

# Copy api source and build
COPY apps/api/ ./
RUN npm run build

# ─── Production image ────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app/apps/api

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/prisma ../../prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

CMD ["node", "dist/server.js"]
