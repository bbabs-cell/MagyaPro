-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courierId" TEXT,
ADD COLUMN     "deliveryCode" TEXT,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "orders_courierId_status_idx" ON "orders"("courierId", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
