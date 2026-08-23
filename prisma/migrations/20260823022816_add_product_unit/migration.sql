warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UNIT', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'PACK');

-- AlterTable
ALTER TABLE "boutique_products" ADD COLUMN     "unit" "ProductUnit" NOT NULL DEFAULT 'UNIT';

