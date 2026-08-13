-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'NEEDS_CLEANING');

-- AlterEnum
ALTER TYPE "FulfillmentType" ADD VALUE 'DINE_IN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TABLE_CALL';
ALTER TYPE "NotificationType" ADD VALUE 'TABLE_BILL_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'RESERVATION_CREATED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tableId" TEXT;

-- AlterTable
ALTER TABLE "restaurant_settings" ADD COLUMN     "tableOrderingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_token_key" ON "restaurant_tables"("token");

-- CreateIndex
CREATE INDEX "restaurant_tables_restaurantId_position_idx" ON "restaurant_tables"("restaurantId", "position");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
