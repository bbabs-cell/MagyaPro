-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "orderCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "boutique_orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "boutique_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boutique_orders_storeId_status_idx" ON "boutique_orders"("storeId", "status");

-- CreateIndex
CREATE INDEX "boutique_orders_storeId_createdAt_idx" ON "boutique_orders"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_orders_storeId_number_key" ON "boutique_orders"("storeId", "number");

-- CreateIndex
CREATE INDEX "boutique_order_items_orderId_idx" ON "boutique_order_items"("orderId");

-- CreateIndex
CREATE INDEX "boutique_order_items_productVariantId_idx" ON "boutique_order_items"("productVariantId");

-- AddForeignKey
ALTER TABLE "boutique_orders" ADD CONSTRAINT "boutique_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_order_items" ADD CONSTRAINT "boutique_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "boutique_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_order_items" ADD CONSTRAINT "boutique_order_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

