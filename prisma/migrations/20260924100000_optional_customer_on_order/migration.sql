-- Commande sans client identifié : le téléphone et la fiche client deviennent
-- facultatifs sur une commande.
--
-- Jusqu'ici, toute commande venait du site public, où le client saisit
-- lui-même son numéro — il était donc toujours présent, et servait de clé
-- d'identification de la fiche client au sein du restaurant.
--
-- Le restaurateur peut désormais saisir une commande depuis son tableau de
-- bord, pour un client qui appelle ou qui se présente au comptoir. Au
-- téléphone, le numéro est connu. Au comptoir, il ne l'est pas, et rien ne
-- justifie de le réclamer à quelqu'un qui paie un plat à emporter.
--
-- Deux façons de contourner cela ont été écartées :
--   - un numéro inventé fausserait le fichier client et l'historique d'achat ;
--   - une chaîne vide entrerait en collision dès la deuxième commande
--     anonyme, `(restaurantId, phone)` étant unique sur la fiche client.
--
-- Une commande sans numéro ne crée donc aucune fiche client : elle ne compte
-- ni dans le nombre de commandes d'un client, ni dans son total dépensé.
--
-- Le téléphone reste exigé en livraison, côté applicatif : sans lui, le
-- livreur ne peut joindre personne et le code de remise n'a pas de
-- destinataire.
--
-- Migration élargissante : elle retire deux contraintes, n'en ajoute aucune,
-- et ne touche à aucune donnée existante. Les commandes déjà enregistrées
-- gardent leur client et leur numéro.

ALTER TABLE "orders" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "customerPhone" DROP NOT NULL;
