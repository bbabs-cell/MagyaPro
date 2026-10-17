-- Comptes de test : exclus des chiffres de la plateforme (recette,
-- statistiques, abonnements, utilisateurs). Deux colonnes ajoutées, à valeur
-- par défaut : aucune donnée existante n'est modifiée.
-- `IF NOT EXISTS` : peut être exécutée à la main avant le déploiement sans
-- faire échouer un `prisma migrate deploy` ultérieur.

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
