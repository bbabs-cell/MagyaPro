-- Déclinaisons réelles (tailles, pointures, couleurs) — phase 3.
--
-- Les variantes existaient déjà en base ; ce qui manquait était la liste des
-- axes du produit, sans laquelle la caisse ne sait pas quelles pastilles
-- proposer ni dans quel ordre.
--
-- Purement additif : `[]` = produit sans déclinaison, le cas de toutes les
-- fiches existantes.

ALTER TABLE "boutique_products"
  ADD COLUMN "variantAxes" JSONB NOT NULL DEFAULT '[]';
