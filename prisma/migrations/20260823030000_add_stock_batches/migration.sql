-- CreateTable
CREATE TABLE "boutique_stock_batches" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boutique_stock_batches_storeId_expiryDate_idx" ON "boutique_stock_batches"("storeId", "expiryDate");

-- CreateIndex
CREATE INDEX "boutique_stock_batches_productVariantId_warehouseId_expiryD_idx" ON "boutique_stock_batches"("productVariantId", "warehouseId", "expiryDate");

-- AddForeignKey
ALTER TABLE "boutique_stock_batches" ADD CONSTRAINT "boutique_stock_batches_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_stock_batches" ADD CONSTRAINT "boutique_stock_batches_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_stock_batches" ADD CONSTRAINT "boutique_stock_batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "boutique_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

