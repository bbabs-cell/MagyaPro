-- Lien de suivi des commandes : clé aléatoire de 32 octets, dont seule
-- l'empreinte est conservée. Colonne vide pour les commandes existantes, qui
-- restent joignables par leur identifiant. `IF NOT EXISTS` : exécutable à la
-- main avant le déploiement sans gêner un `prisma migrate deploy` ultérieur.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "accessTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orders_accessTokenHash_key" ON "orders"("accessTokenHash");
