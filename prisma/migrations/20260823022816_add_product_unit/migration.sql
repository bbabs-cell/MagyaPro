-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UNIT', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'PACK');

-- AlterTable
ALTER TABLE "boutique_products" ADD COLUMN     "unit" "ProductUnit" NOT NULL DEFAULT 'UNIT';
