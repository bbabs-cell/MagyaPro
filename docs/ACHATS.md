# Commandes fournisseurs, réception, paiement — phase 10

Une partie de ce domaine avait déjà été reprise plus tôt dans la campagne, à
votre demande : la suppression du système de dette et son remplacement par un
règlement rattaché à chaque commande. Cette phase reprend le §13 et le §14
point par point et comble ce qui manquait — dont deux défauts sur l'argent qui
n'étaient dans aucun audit.

---

## §14 — le paiement était ailleurs

Le §14 est explicite, et le parcours réel était exactement celui qu'il
proscrit :

> réceptionner → sortir → aller ailleurs → chercher la facture → ouvrir le
> paiement → revenir → vérifier

L'écran de réception se fermait dès la confirmation. Pour régler, il fallait
revenir à la liste, ouvrir la fiche du fournisseur, cliquer « Payer », et
**retrouver la commande dans une liste déroulante** — celle qu'on venait de
réceptionner trente secondes plus tôt.

### Ce que l'écran de réception montre maintenant

En haut, l'argent, avant même les quantités :

| Commandé | Livré à ce jour | Déjà réglé | Reste à payer |
|---|---|---|---|

Avec le statut du règlement en badge — **Payée**, **Payée en partie**, **Non
payée** — comme le demande le §14.

En bas, sur la même page, deux gestes :

- **« Marquer comme payé · 42 000 F CFA »** — le montant est repris du solde,
  pas retapé. Un montant retapé est un montant qu'on peut mal taper ;
- **« Verser un acompte »** — qui ouvre un champ pour un montant partiel.

**La réception ne referme plus l'écran.** On confirme la livraison, les
montants se recalculent, et le règlement suit immédiatement — pendant que le
livreur du fournisseur attend son argent, ce qui est le moment exact où la
question se pose.

Pour que cela fonctionne, l'écran retient désormais la commande **par son
identifiant** et non par une copie de l'objet. Une copie serait figée à
l'ouverture : on réceptionnerait, on paierait, et on lirait encore les chiffres
d'avant.

Le règlement depuis la fiche du fournisseur reste disponible : « je paie
Diallo aujourd'hui, sur quelle commande ? » est une autre question, légitime,
et la réponse n'est pas au même endroit.

---

## Deux défauts sur l'argent, absents des audits

### 1. Rien n'empêchait d'enregistrer un règlement de n'importe quel montant

`addSupplierPayment` vérifiait que la commande existait et appartenait bien au
fournisseur, puis enregistrait le montant tel quel. **Aucun plafond.** Un zéro
de trop sur un clavier de téléphone — 500 000 au lieu de 50 000 — passait sans
un mot et faussait la trésorerie du mois.

Le plafond est désormais la **valeur commandée**, frais annexes compris, et non
la valeur livrée : payer d'avance une marchandise qui n'est pas encore arrivée
est courant avec un nouveau fournisseur, et le refuser bloquerait une pratique
légitime. Au-delà du bon de commande, en revanche, plus rien ne justifie le
versement — le refus nomme ce qui reste réellement à verser.

### 2. Le trop-versé était absorbé sans un mot

Le reste à payer était calculé avec un `Math.max(0, dû − payé)`. Un commerçant
qui avait versé quarante mille francs de trop lisait « Payée », reste
« 0 F CFA », et n'apprenait rien.

L'écart apparaît maintenant, formulé pour ce qu'il est le plus souvent — une
avance sur le reste de la commande, pas une faute :

> Vous avez versé 40 000 F CFA de plus que ce qui est livré — une avance sur le
> reste de la commande.

Sept tests couvrent le plafond et l'avance, dont le cas de l'unité d'achat
groupée (un carton de douze) où l'ordre des divisions décide de quelques francs.

---

## §13 — le total manquait

Le formulaire de commande affichait le total de **chaque ligne** et jamais
celui de la commande. Sur cinq lignes, on validait sans savoir ce qu'on
engageait, et il fallait attendre le retour à la liste pour le découvrir.

Le §13 demande, dans l'ordre : choisir le fournisseur, ajouter les produits,
indiquer les quantités, **voir le total**, **voir le récapitulatif**, valider.
Les quatre premiers points étaient là ; les deux suivants manquaient.

Un récapitulatif se met à jour à chaque frappe, juste au-dessus du bouton qui
engage la dépense : nombre de produits, sous-total, frais annexes, total. Les
frais annexes sont devenus un champ contrôlé pour y entrer — un total qui
ignore le transport n'est pas le total.

Le bouton « Commander » est inactif tant qu'aucun produit n'est choisi, plutôt
que de laisser partir une commande vide vers un refus du serveur.

Les cinq statuts demandés par le §13 — Brouillon, Commandée, Partiellement
reçue, Reçue, Annulée — existaient déjà et sont correctement libellés.

---

## Audit de sécurité de la phase

**Le plafond de règlement est calculé côté serveur, à partir de la commande.**
Le montant envoyé par le navigateur n'est jamais retenu comme référence : le
serveur relit les lignes, additionne, compare, et refuse au-delà. Même
principe qu'à la phase 8 pour l'encaissement du livreur.

**Le contrôle d'appartenance est inchangé.** La commande doit appartenir au
commerce **et** au fournisseur visé ; la requête ajoutée pour calculer le
plafond porte les mêmes conditions que celle qu'elle remplace.

**Aucune permission n'a changé.** Régler depuis l'écran de réception exige
exactement la même permission que régler depuis la fiche du fournisseur —
c'est la même route.

**Le message de refus ne fuit rien** : il nomme un montant restant, déjà connu
de la personne qui remplit le formulaire, et rien d'autre. Il est formaté avec
la devise du commerce plutôt qu'en unité mineure brute, sans quoi un montant en
euros s'afficherait multiplié par cent.

---

## Ce que cette phase n'a pas couvert

**Le formulaire de création de fournisseur** et une partie du formulaire de
commande utilisent encore l'ancien enchaînement d'attente, sans confirmation.
Ils fonctionnent ; ils rejoindront la règle commune avec les autres écrans de
réglage.

**Le test humain.** Le parcours à vérifier : créer une commande à plusieurs
lignes en regardant le total se former, la confirmer, la réceptionner
partiellement, verser un acompte sans quitter l'écran, puis solder. Et une
tentative de règlement absurde — dix fois le montant — pour voir le refus.
