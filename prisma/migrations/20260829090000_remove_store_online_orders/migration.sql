-- Retrait du site public et des commandes en ligne de MagyaPro Boutique.
--
-- MagyaPro Boutique devient un outil purement interne : caisse, stock,
-- achats, clients, finances. Il n'expose plus de vitrine publique, donc plus
-- de commandes en ligne, plus de domaines de boutique et plus de mises en
-- page de site.
--
-- SUPPRESSION DÉFINITIVE. Les commandes en ligne déjà enregistrées sont
-- effacées : c'est le choix explicite retenu, à la différence des clés d'API
-- dont les tables avaient été laissées en place.
--
-- MagyaPro Restaurant n'est pas concerné : ses propres tables `orders`,
-- `domains` et `templates` sont distinctes et restent intactes.

-- Les lignes d'abord : elles référencent les commandes.
DROP TABLE IF EXISTS "boutique_order_items";
DROP TABLE IF EXISTS "boutique_orders";

-- Domaines des boutiques (sous-domaines attribués et domaines personnalisés).
DROP TABLE IF EXISTS "store_domains";

-- Mises en page du site public des boutiques.
DROP TABLE IF EXISTS "store_templates";

-- Compteur de numérotation des commandes en ligne. `saleCounter`, qui numérote
-- les ventes en caisse, n'est pas touché.
ALTER TABLE "stores" DROP COLUMN IF EXISTS "orderCounter";

-- Les types énumérés ne servaient qu'aux tables ci-dessus.
DROP TYPE IF EXISTS "StoreOrderStatus";
DROP TYPE IF EXISTS "StoreDomainStatus";
DROP TYPE IF EXISTS "StoreDomainType";
