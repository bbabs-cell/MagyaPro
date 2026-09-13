# Reçus, tickets, factures — phase 13

Le §22 demande « le même système pour Restaurant et Boutique » et une identité
documentaire reconnaissable. Il y avait trois documents écrits séparément, qui
divergeaient déjà — et un défaut plus sérieux découvert en chemin : **une
boutique ne pouvait pas corriger ce qui s'imprime sur ses propres factures.**

Une migration a été nécessaire : deux colonnes nullables.

---

## Trois documents, trois mises en page

| | Facture Boutique | Reçu Restaurant | Reçu d'abonnement |
|---|---|---|---|
| logo du commerce | oui | **non** | — |
| détail du règlement | oui | **non** | non |
| reste à payer | oui | **non** | — |
| options du plat facturées | — | **non** | — |
| identifiant légal | **non** | **non** | — |

Le reçu Restaurant ne disait donc **ni si la commande avait été payée, ni
comment** — l'information qu'un client vient chercher sur un reçu, et celle qui
fait foi si la question se pose plus tard. Depuis la phase 8, un livreur peut
encaisser sur le pas de la porte ; rien de tout cela n'apparaissait.

Les options choisies non plus : un client qui avait payé un supplément fromage
ne le voyait nulle part sur ce qu'il emportait.

### Un jeu de pièces commun

`src/components/documents/` porte l'en-tête, le bloc client, le tableau des
lignes, les totaux, le règlement et le pied de page. Les trois documents les
assemblent, et l'enveloppe d'impression — la palette figée en clair, recopiée
à l'identique dans deux fichiers — est elle aussi partagée.

L'identité tient à peu de chose, volontairement : un filet orange sous
l'en-tête et le mot « Facture » ou « Reçu » dans la même couleur. Le reste du
papier appartient au commerce, pas à MagyaPro.

Les totaux passent sur un fond légèrement teinté, comme le demande le §22 —
c'est le chiffre qu'on cherche en premier sur une facture.

### Ce qui survit à l'impression

Un document finit sur du papier. Les navigateurs suppriment les fonds à
l'impression par défaut ; le filet et les fonds teintés portent donc la classe
qui les force à rester. Et le reste tient sans couleur : hiérarchie, graisses,
filets sombres — une impression en noir et blanc reste lisible.

---

## Le défaut trouvé en chemin

**Une boutique ne pouvait pas modifier son nom, son adresse ni son téléphone.**

Ces informations sont demandées une fois, à l'inscription, et **aucun écran ne
permettait de les corriger ensuite**. Elles figurent pourtant en haut de chaque
facture remise à un client. Un commerçant qui déménageait, changeait de numéro,
ou avait simplement fait une faute de frappe le premier jour, la voyait
imprimée indéfiniment.

Ce n'est pas un manque de confort : c'est un document commercial faux, que le
commerçant ne peut pas réparer.

Les réglages de la boutique ouvrent désormais sur un panneau **Identité de la
boutique** — nom, téléphone, adresse, ville, pays, numéro d'identification. Il
est placé en premier : c'est ce que voient les clients.

---

## Les informations fiscales

Le §22 demande que les documents puissent afficher les « informations fiscales
si disponibles ». Aucun champ ne permettait de les renseigner.

La colonne `legalId` est ajoutée aux deux côtés — NINEA, RCCM, IFU selon le
pays. Le format n'est pas contraint : il varie d'un pays à l'autre et le
produit n'a pas à en imposer un. La valeur s'imprime telle qu'elle est saisie,
et n'apparaît pas du tout tant qu'elle est vide.

Elle est saisissable des deux côtés — dans les réglages du restaurant, et dans
le nouveau panneau d'identité de la boutique. **Une colonne qu'aucun écran ne
peut remplir ne sert à rien** ; c'est pourquoi la migration et les deux
formulaires arrivent ensemble.

---

## Audit de sécurité de la phase

**La migration est purement additive.** Deux colonnes nullables, aucune ligne
modifiée, aucun écran changé tant que le champ est vide.

**La nouvelle route d'identité applique les contrôles habituels.** Permission
`settings:manage`, boutique résolue depuis la session et jamais depuis le corps
de la requête, entrée validée par un schéma, action consignée au journal.

**Les documents ne montrent rien de nouveau qui soit sensible.** Ils affichent
ce que le commerce a saisi sur lui-même, et le détail d'une vente que
l'utilisateur pouvait déjà consulter. Les protections d'accès des trois pages
sont inchangées : compte connecté, commerce associé, permission de lecture des
ventes ou des commandes.

**Aucun chiffre n'est recalculé pour l'affichage.** Le §22 insiste : « ne
jamais générer des données différentes de la caisse ou de la commande ». Les
montants viennent des mêmes colonnes qu'avant. La seule addition faite ici est
la somme des règlements enregistrés, pour en déduire le reste dû — et elle
compte un encaissement de livreur comme versé par le client, ce qui est son
point de vue à lui.

**Le champ de format libre est borné en longueur** et rendu comme du texte par
React, qui échappe.

---

## Ce que cette phase n'a pas couvert

**Le logo de la boutique.** Le champ existe en base et s'imprime, mais rien ne
permet de le téléverser côté Boutique — le Restaurant, lui, a son
téléversement. Le nouveau panneau d'identité est l'endroit naturel pour
l'ajouter, avec le redimensionnement local déjà écrit.

**Le bon de livraison** mentionné par le §22 comme « si nécessaire ». Les
pièces existent maintenant pour l'assembler en une trentaine de lignes le jour
où il est demandé.

**Le test humain.** Imprimez une facture Boutique et un reçu Restaurant, en
couleur puis en noir et blanc, et regardez si les deux se ressemblent et
restent lisibles.
