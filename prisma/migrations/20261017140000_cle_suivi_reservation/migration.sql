-- Lien de suivi des réservations : clé aléatoire de 32 octets, dont seule
-- l'empreinte est conservée. Colonne vide pour les réservations existantes,
-- qui restent joignables par leur identifiant. `IF NOT EXISTS` : exécutable à
-- la main avant le déploiement sans gêner un `prisma migrate deploy` ultérieur.

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "accessTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reservations_accessTokenHash_key" ON "reservations"("accessTokenHash");
