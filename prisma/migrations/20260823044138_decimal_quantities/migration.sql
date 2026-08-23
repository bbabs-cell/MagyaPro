-- AlterTable
ALTER TABLE "boutique_products" ALTER COLUMN "minStockAlert" SET DEFAULT 0,
ALTER COLUMN "minStockAlert" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_inventory" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "reservedQuantity" SET DEFAULT 0,
ALTER COLUMN "reservedQuantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_inventory_movements" ALTER COLUMN "quantityChange" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "quantityBefore" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "quantityAfter" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_stock_batches" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "remainingQuantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_stock_transfer_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_purchase_order_items" ALTER COLUMN "quantityOrdered" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "quantityReceived" SET DEFAULT 0,
ALTER COLUMN "quantityReceived" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_sale_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "boutique_return_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3);

