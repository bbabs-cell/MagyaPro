-- CreateEnum
CREATE TYPE "PlanProduct" AS ENUM ('RESTAURANT', 'STORE');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "product" "PlanProduct" NOT NULL DEFAULT 'RESTAURANT';

-- CreateIndex
CREATE INDEX "plans_product_isActive_idx" ON "plans"("product", "isActive");

