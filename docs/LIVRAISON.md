# Livraison et paiement livreur — phase 8

Le §17 demande d'ajouter « une gestion claire du paiement lors de la
livraison ». Il n'y en avait aucune.

**Aucune modification de la base n'a été nécessaire.** Le journal des paiements
existait déjà et convenait ; il ne manquait que de s'en servir au bon moment.

---

## Le trou

Une commande réglée en espèces à la livraison passe par **deux** mains avant
d'arriver au restaurant :

1. le client donne l'argent au livreur, sur le pas de la porte ;
2. le livreur rapporte l'argent au restaurant, en fin de tournée.

Le produit ne connaissait que la seconde. Le livreur confirmait la remise du
plat avec le code du client, et c'était tout. Rien n'enregistrait s'il avait
été payé, combien, ni par quel moyen : **entre la porte du client et la caisse
du restaurant, l'argent n'existait nulle part.** Un livreur qui rentrait avec
la moitié de la somme n'avait aucune trace à opposer, et le restaurateur aucune
trace à lui opposer.

---

## Ce que le livreur voit et fait maintenant

Sur chaque course, en gros et à part du reste, **le montant à encaisser** — ou
la mention « Déjà payée » si la commande a été réglée en ligne. C'est la
première chose à lire avant de sonner, et réclamer deux fois la même somme est
l'incident le plus coûteux d'une tournée.

Avant de saisir le code de remise, une seule question : **le client a-t-il
payé ?**

| Réponse | Ce qui est enregistré |
|---|---|
| Payé en entier | le montant dû, au moyen indiqué |
| Payé en partie | le montant reçu, et l'écart |
| Pas payé | rien d'encaissé, la somme reste due |

Le détail — montant, moyen de paiement — n'apparaît que lorsqu'il est
nécessaire : un encaissement complet en espèces, qui est le cas courant, reste
un seul appui.

---

## Les deux décisions structurantes

### 1. L'encaissement du livreur ne marque pas la commande « payée »

C'est le cœur de la phase, et c'est délibéré.

`PAID` signifie aujourd'hui, partout dans le produit, **« le restaurant a
l'argent »** : les recettes, le compte de résultat et la clôture de caisse en
dépendent. Marquer `PAID` dès que le livreur déclare avoir été payé ferait
compter au restaurant un argent qui est encore dans la poche de quelqu'un
d'autre — et qui peut ne jamais arriver.

La déclaration du livreur est donc enregistrée **« en cours »** : encaissée, en
route. Elle devient « payée » quand le restaurant constate avoir reçu les
espèces, exactement comme avant.

Il y a donc **trois** situations, là où le §17 en annonce deux, et la troisième
est justement la plus fréquente :

| Situation | Ce que le restaurant lit |
|---|---|
| le client n'a pas payé | **Non payée** |
| le livreur a l'argent | **Encaissée par le livreur** |
| le restaurant a l'argent | **Payée** |

Le libellé générique des paiements dit « En cours » pour le cas du milieu. Cela
ne renseigne pas un restaurateur qui cherche à savoir **de qui** réclamer sa
recette. Les livraisons ont donc leur propre formulation.

### 2. Le livreur ne fixe jamais le montant

Le montant attendu vient de la commande, jamais de l'appareil du livreur.

- « Payé en entier » vaut exactement ce qui est dû, **quoi que le téléphone
  envoie** — un appareil trafiqué qui annoncerait 500 sur une commande de 5 000
  est simplement ignoré ;
- un paiement partiel est borné entre 1 et le dû moins un : impossible de
  déclarer avoir reçu plus que dû, ce qui gonflerait la recette, ni zéro
  déguisé en partiel ;
- le montant dû est recalculé côté serveur en retranchant ce qui a déjà été
  réglé — le même chiffre que celui montré au livreur, pour qu'un partiel
  légitime ne soit pas refusé et qu'un partiel excessif ne passe pas.

Neuf tests couvrent ces bornes, dont le cas du téléphone trafiqué.

---

## L'écart est consigné en clair

L'historique de la commande porte la phrase, visible par le restaurateur :

> Encaissé par le livreur : 3 000 F CFA sur 5 000 F CFA (Espèces) — écart de
> 2 000 F CFA.

ou, s'il n'a rien reçu :

> Livré sans paiement — 5 000 F CFA restent dus.

---

## Deux nettoyages faits en chemin

**Une lecture en double.** La liste des courses existait deux fois — une dans
la page, une dans la route interrogée toutes les quinze secondes par le même
écran. Les deux devaient rester identiques champ pour champ, sans que rien ne
l'impose. La première divergence a cassé le typage ; une divergence plus
discrète aurait donné un écran dont le contenu change au premier
rafraîchissement automatique. Les deux passent maintenant par `lib/deliveries`.

**Un contournement de l'invariant.** J'avais d'abord écrit le changement de
statut du paiement directement en base. C'était faux : `applyPaymentStatus`
vérifie la transition, aligne le statut de la commande et consigne l'action.
Le contourner laissait une commande « en attente » avec un paiement « en
cours ». L'écriture passe par lui.

---

## Audit de sécurité de la phase

**Le livreur ne peut pas modifier le montant d'une commande.** Vérifié par
construction et par test : le total vient de la base, le partiel est borné, et
aucune valeur envoyée par l'appareil n'est retenue pour un paiement complet.

**Il ne peut pas encaisser une course qui n'est pas la sienne.** Les contrôles
existants sont inchangés : commande du bon restaurant, livreur assigné, statut
« en cours de livraison », et code à six chiffres avec limitation du nombre
d'essais.

**Il ne voit pas plus qu'avant.** Le reste à percevoir est calculé côté
serveur ; les lignes de paiement qui servent au calcul ne sortent pas de
l'API. Un livreur n'a pas à connaître l'historique des règlements d'un client.

**Aucune double ligne de paiement.** La déclaration renseigne la ligne en
attente créée à la commande plutôt que d'en ouvrir une seconde. Deux lignes
pour un seul règlement fausseraient le total des encaissements.

**Une commande déjà réglée en ligne ne peut pas être encaissée deux fois.** La
déclaration est ignorée dans ce cas, même si l'appareil en envoie une.

---

## Ce que cette phase n'a pas couvert

**La remise de la tournée.** Le restaurant confirme commande par commande
qu'il a reçu l'argent. Un écran « ce que chaque livreur me doit ce soir »
serait le prolongement naturel, mais le §17 ne le demande pas et il touche aux
écrans de finances.

**Le test humain.** Le parcours complet — prendre une course, encaisser
partiellement, confirmer, puis valider côté restaurant — se juge sur un
téléphone, pas dans un diff.
