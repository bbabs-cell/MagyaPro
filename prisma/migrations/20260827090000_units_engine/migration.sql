-- =====================================================================
-- Moteur d'unités Boutique — phase 1
--
-- 1. Précision des quantités portée de 3 à 6 décimales (14,3 -> 18,6).
-- 2. Unités par boutique + conversions et prix par unité de variante.
-- 3. Unité de base par produit.
-- 4. Vente à découvert (réglage par boutique).
-- 5. Traçabilité de l'unité sur les lignes de vente et d'achat.
--
-- Purement additif : aucune colonne supprimée, aucune donnée réécrite.
-- Les lignes existantes gardent unitFactor = 1, ce qui redonne exactement
-- les mêmes totaux qu'aujourd'hui.
-- =====================================================================

-- Prérequis : exécuter d'abord `20260827085000_business_type_sectors`.

-- --- 1. Précision : 3 -> 6 décimales ---------------------------------
-- Élargissement pur (18,6 contient tout ce que 14,3 pouvait stocker) :
-- aucune valeur existante n'est tronquée ni arrondie.

ALTER TABLE "boutique_products"
  ALTER COLUMN "minStockAlert" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_inventory"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6),
  ALTER COLUMN "reservedQuantity" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_inventory_movements"
  ALTER COLUMN "quantityChange" TYPE DECIMAL(18,6),
  ALTER COLUMN "quantityBefore" TYPE DECIMAL(18,6),
  ALTER COLUMN "quantityAfter" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_stock_batches"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6),
  ALTER COLUMN "remainingQuantity" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_stock_transfer_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_purchase_order_items"
  ALTER COLUMN "quantityOrdered" TYPE DECIMAL(18,6),
  ALTER COLUMN "quantityReceived" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_sale_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_return_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6);

ALTER TABLE "boutique_order_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6);

-- --- 2. Unités par boutique ------------------------------------------

CREATE TABLE "boutique_units" (
  "id"          TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "labelPlural" TEXT,
  "isDecimal"   BOOLEAN NOT NULL DEFAULT false,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "boutique_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "boutique_units_storeId_code_key"
  ON "boutique_units"("storeId", "code");
CREATE INDEX "boutique_units_storeId_isActive_idx"
  ON "boutique_units"("storeId", "isActive");

ALTER TABLE "boutique_units"
  ADD CONSTRAINT "boutique_units_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- --- 3. Conversions et prix par unité de variante ---------------------

CREATE TABLE "boutique_variant_units" (
  "id"               TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "unitId"           TEXT NOT NULL,
  "factor"           DECIMAL(18,6) NOT NULL,
  "price"            INTEGER,
  "cost"             INTEGER,
  "isSellable"       BOOLEAN NOT NULL DEFAULT true,
  "isPurchasable"    BOOLEAN NOT NULL DEFAULT true,
  "position"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "boutique_variant_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "boutique_variant_units_productVariantId_unitId_key"
  ON "boutique_variant_units"("productVariantId", "unitId");
CREATE INDEX "boutique_variant_units_unitId_idx"
  ON "boutique_variant_units"("unitId");

ALTER TABLE "boutique_variant_units"
  ADD CONSTRAINT "boutique_variant_units_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boutique_variant_units"
  ADD CONSTRAINT "boutique_variant_units_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "boutique_units"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- --- 4. Unité de base du produit --------------------------------------

ALTER TABLE "boutique_products" ADD COLUMN "baseUnitId" TEXT;

CREATE INDEX "boutique_products_baseUnitId_idx"
  ON "boutique_products"("baseUnitId");

ALTER TABLE "boutique_products"
  ADD CONSTRAINT "boutique_products_baseUnitId_fkey"
  FOREIGN KEY ("baseUnitId") REFERENCES "boutique_units"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- --- 5. Vente à découvert ---------------------------------------------

ALTER TABLE "stores"
  ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;

-- --- 6. Unité figée sur les lignes de vente et d'achat -----------------
-- unitFactor = 1 sur tout l'existant : le total reste `unitPrice x quantity`,
-- exactement comme avant cette migration.

ALTER TABLE "boutique_sale_items"
  ADD COLUMN "unitId"     TEXT,
  ADD COLUMN "unitLabel"  TEXT,
  ADD COLUMN "unitFactor" DECIMAL(18,6) NOT NULL DEFAULT 1;

ALTER TABLE "boutique_purchase_order_items"
  ADD COLUMN "unitId"     TEXT,
  ADD COLUMN "unitLabel"  TEXT,
  ADD COLUMN "unitFactor" DECIMAL(18,6) NOT NULL DEFAULT 1;
