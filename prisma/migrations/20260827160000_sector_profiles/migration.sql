-- Profils de secteur et unités personnalisées — phase 4.
--
-- `defaultFactor` : conversion habituelle d'une unité dans une boutique
-- donnée (« chez moi un plateau fait toujours 30 »), pré-remplie à l'ajout de
-- l'unité sur une fiche produit. Purement indicatif — la conversion qui fait
-- foi reste celle de la fiche, parce qu'un carton ne contient pas le même
-- nombre d'unités d'un produit à l'autre.
--
-- `isCustom` : distingue les unités créées par le commerçant de celles issues
-- du catalogue. Seules les premières peuvent être renommées librement ou
-- supprimées quand rien ne les référence.

ALTER TABLE "boutique_units"
  ADD COLUMN "defaultFactor" DECIMAL(18,6),
  ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
