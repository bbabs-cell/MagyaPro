-- AlterTable
ALTER TABLE "boutique_supplier_payments" ADD COLUMN     "purchaseOrderId" TEXT;
-- AlterTable
ALTER TABLE "boutique_purchase_orders" ADD COLUMN     "expectedAt" TIMESTAMP(3);
-- CreateIndex
CREATE INDEX "boutique_supplier_payments_purchaseOrderId_idx" ON "boutique_supplier_payments"("purchaseOrderId");
-- AddForeignKey
ALTER TABLE "boutique_supplier_payments" ADD CONSTRAINT "boutique_supplier_payments_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "boutique_purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
