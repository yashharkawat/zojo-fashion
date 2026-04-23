-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "variantColor" TEXT;

-- CreateIndex
CREATE INDEX "ProductImage_productId_variantColor_idx" ON "ProductImage"("productId", "variantColor");

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default social URLs (idempotent insert)
INSERT INTO "SiteSettings" ("id", "instagramUrl", "youtubeUrl", "updatedAt")
VALUES (
  'default',
  'https://www.instagram.com/100days.fashion',
  'https://www.youtube.com/@yashharkawat6147',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "instagramUrl" = EXCLUDED."instagramUrl",
  "youtubeUrl" = EXCLUDED."youtubeUrl",
  "updatedAt" = CURRENT_TIMESTAMP;
