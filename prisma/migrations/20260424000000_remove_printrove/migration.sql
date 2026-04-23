-- Remove Printrove integration (columns + enum + indexes)

DROP INDEX IF EXISTS "Order_printroveSyncStatus_status_idx";
DROP INDEX IF EXISTS "Order_printroveOrderId_key";
DROP INDEX IF EXISTS "ProductVariant_printroveVariantId_key";
DROP INDEX IF EXISTS "ProductVariant_printroveVariantId_idx";

ALTER TABLE "Order" DROP COLUMN IF EXISTS "printroveOrderId",
  DROP COLUMN IF EXISTS "printroveSyncStatus",
  DROP COLUMN IF EXISTS "printroveLastSyncedAt",
  DROP COLUMN IF EXISTS "printroveLastError",
  DROP COLUMN IF EXISTS "printroveRetryCount";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "printroveProductId",
  DROP COLUMN IF EXISTS "printroveSyncStatus",
  DROP COLUMN IF EXISTS "printroveLastSyncedAt";

ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "printroveVariantId",
  DROP COLUMN IF EXISTS "printroveBlankSku";

ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "printroveSku";

DROP TYPE IF EXISTS "PrintroveSyncStatus";
