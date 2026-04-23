-- Remove tables with no app usage (no prisma.* read/write in codebase).
-- Cart/ CartItem: storefront cart is Redux-only.
-- AdminProfile, CouponUsage, Receipt: never wired.

DROP TABLE IF EXISTS "CartItem" CASCADE;
DROP TABLE IF EXISTS "Cart" CASCADE;
DROP TABLE IF EXISTS "CouponUsage" CASCADE;
DROP TABLE IF EXISTS "Receipt" CASCADE;
DROP TABLE IF EXISTS "AdminProfile" CASCADE;
