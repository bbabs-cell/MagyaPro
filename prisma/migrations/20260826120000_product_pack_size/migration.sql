-- Vente par carton (ex. carton de 20 bouteilles) : taille, coût et prix du
-- carton sur la variante ; le stock reste toujours compté en unités de base.
ALTER TABLE "boutique_product_variants" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "boutique_product_variants" ADD COLUMN "packCost" INTEGER;
ALTER TABLE "boutique_product_variants" ADD COLUMN "packPrice" INTEGER;

-- Trace, par ligne de vente, si elle a été vendue à l'unité ou au carton.
CREATE TYPE "SaleUnit" AS ENUM ('UNIT', 'PACK');
ALTER TABLE "boutique_sale_items" ADD COLUMN "saleUnit" "SaleUnit" NOT NULL DEFAULT 'UNIT';
