-- Prévision des ruptures — deux repères de réapprovisionnement par produit.
--
-- `maxStock` plafonne la quantité recommandée à la commande : sans lui, un
-- produit à forte rotation se verrait conseiller des volumes intenables.
--
-- `supplierLeadDays` est ce qui distingue « stock faible » (gênant) de
-- « rupture imminente » (le réassort n'arrivera pas à temps). Nullable :
-- sans délai renseigné, la prévision retombe sur le seuil d'alerte seul.

ALTER TABLE "boutique_products"
  ADD COLUMN "maxStock" DECIMAL(18,6),
  ADD COLUMN "supplierLeadDays" INTEGER;
