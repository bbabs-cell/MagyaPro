-- Identifiant tiré par la caisse avant le premier envoi d'une vente, pour
-- qu'une vente renvoyée après une réponse perdue ne soit pas créée deux fois.
-- Colonne facultative : les ventes existantes gardent NULL, et plusieurs NULL
-- coexistent sous une contrainte d'unicité PostgreSQL.
ALTER TABLE "boutique_sales" ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "boutique_sales_storeId_clientRequestId_key"
  ON "boutique_sales"("storeId", "clientRequestId");
