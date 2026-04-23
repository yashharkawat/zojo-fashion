-- Replace Category / Collection / Coupon / status history / wishlist / reviews / etc.
-- with a slimmer model (see `prisma/schema.prisma`).

-- ─── Product: categoryId → categorySlug ─────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categorySlug" TEXT;

UPDATE "Product" AS p
SET "categorySlug" = c."slug"
FROM "Category" AS c
WHERE c."id" = p."categoryId";

UPDATE "Product" SET "categorySlug" = 'oversized' WHERE "categorySlug" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "categorySlug" SET NOT NULL;

DROP INDEX IF EXISTS "Product_categoryId_isActive_deletedAt_idx";

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "categoryId";

CREATE INDEX IF NOT EXISTS "Product_categorySlug_isActive_deletedAt_idx"
  ON "Product" ("categorySlug", "isActive", "deletedAt");

-- ─── Payment: refund metadata on the payment row ───────
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "lastRazorpayRefundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundEvents" JSONB;

-- Optional: keep legacy Refund rows as JSON (best-effort, then drop "Refund")
UPDATE "Payment" p
SET "lastRazorpayRefundId" = r."rid"
FROM (
  SELECT "paymentId", MAX("razorpayRefundId") AS "rid"
  FROM "Refund"
  WHERE "razorpayRefundId" IS NOT NULL
  GROUP BY "paymentId"
) r
WHERE r."paymentId" = p."id" AND p."lastRazorpayRefundId" IS NULL;

-- Join tables + lookup tables
DROP TABLE IF EXISTS "CollectionProduct" CASCADE;
DROP TABLE IF EXISTS "Collection" CASCADE;

DROP TABLE IF EXISTS "OrderStatusEvent" CASCADE;

DROP TABLE IF EXISTS "Refund" CASCADE;

DROP TABLE IF EXISTS "Review" CASCADE;
DROP TABLE IF EXISTS "WishlistItem" CASCADE;
DROP TABLE IF EXISTS "Wishlist" CASCADE;

DROP TABLE IF EXISTS "ProcessedWebhookEvent" CASCADE;

DROP TABLE IF EXISTS "AuditLog" CASCADE;

-- Order: drop coupon FK (code snapshot remains on the row)
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_couponId_fkey";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "couponId";

DROP TABLE IF EXISTS "Coupon" CASCADE;
DROP TABLE IF EXISTS "Category" CASCADE;

-- Enums only used by removed Coupon model
DROP TYPE IF EXISTS "CouponType";
DROP TYPE IF EXISTS "CouponStatus";
