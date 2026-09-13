-- MagyaPro — phase 13 : identifiant légal sur les documents
--
-- Ajoute une colonne « legalId » aux restaurants et aux boutiques : NINEA,
-- RCCM, IFU — l'identifiant que porte l'entreprise selon son pays.
--
-- Pourquoi : le §22 demande que les factures et reçus puissent afficher les
-- informations fiscales du commerce. Aucun champ ne permettait de les
-- renseigner, et un client qui a besoin d'une facture en règle a besoin de ce
-- numéro.
--
-- Le format n'est pas contraint : il varie d'un pays à l'autre et le produit
-- n'a pas à en imposer un. La valeur est imprimée telle qu'elle est saisie.
--
-- Migration purement additive :
--   • deux colonnes nullables ;
--   • aucune ligne existante n'est modifiée ;
--   • aucun écran ne change tant que le champ n'est pas rempli.
--
-- Réexécutable sans risque.

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "legalId" TEXT;
ALTER TABLE "stores"      ADD COLUMN IF NOT EXISTS "legalId" TEXT;
