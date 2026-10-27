-- Commande au comptoir hors connexion : identifiant tiré par l'écran avant le
-- premier envoi, pour qu'une commande renvoyée au retour du réseau ne soit pas
-- créée deux fois. Colonne facultative : les commandes existantes et celles du
-- site gardent NULL, et plusieurs NULL coexistent sous une contrainte
-- d'unicité PostgreSQL. `IF NOT EXISTS` : exécutable à la main avant le
-- déploiement sans gêner un `prisma migrate deploy` ultérieur.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orders_restaurantId_clientRequestId_key" ON "orders"("restaurantId", "clientRequestId");
