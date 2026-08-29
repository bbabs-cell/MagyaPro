-- Facturation multi-boutique.
--
-- Deux ajouts, aucune suppression, aucune donnée existante modifiée en dehors
-- du rattrapage explicite plus bas.
--
-- 1. `stores.ownerAccountId` : le compte qui a ouvert la boutique. Toutes les
--    boutiques d'un même compte forment un groupe de facturation. La plus
--    ancienne paie le tarif du plan, les suivantes une majoration.
-- 2. `platform_settings.additionalStorePercent` : cette majoration, en
--    pourcentage du tarif du plan. 75 par défaut.

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "ownerAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "stores_ownerAccountId_createdAt_idx"
  ON "stores" ("ownerAccountId", "createdAt");

ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "additionalStorePercent" INTEGER NOT NULL DEFAULT 75;

-- Rattrapage des boutiques déjà en base : chacune est rattachée à son plus
-- ancien membre de rôle OWNER. Sans cela, toutes les boutiques existantes
-- seraient sans groupe et une deuxième boutique ouverte par un compte
-- historique serait facturée au tarif plein.
UPDATE "stores" AS s
SET "ownerAccountId" = owner."userId"
FROM (
  SELECT DISTINCT ON ("storeId") "storeId", "userId"
  FROM "store_users"
  WHERE "role" = 'OWNER'
  ORDER BY "storeId", "createdAt" ASC
) AS owner
WHERE s."id" = owner."storeId"
  AND s."ownerAccountId" IS NULL;
