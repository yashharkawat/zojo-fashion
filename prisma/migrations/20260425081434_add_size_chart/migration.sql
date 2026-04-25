-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeChartId" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE "SizeChart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SizeChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeChartRow" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "chest" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "sleeve" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SizeChartRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SizeChart_name_key" ON "SizeChart"("name");

-- CreateIndex
CREATE INDEX "SizeChartRow_chartId_sortOrder_idx" ON "SizeChartRow"("chartId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sizeChartId_fkey" FOREIGN KEY ("sizeChartId") REFERENCES "SizeChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SizeChartRow" ADD CONSTRAINT "SizeChartRow_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "SizeChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
