# UX Restaurant — phase 6

Le §15 donne une liste d'actions qui doivent toutes avoir un retour immédiat.
Cette phase la parcourt et la ferme, sauf mention contraire ci-dessous.

---

## La liste du §15, point par point

| Action demandée | Écran | État |
|---|---|---|
| ajouter / modifier / supprimer un plat | menu | fait en phase 5 |
| changer un statut de commande | liste des commandes | fait en phase 4 |
| préparer, marquer prête | cuisine | fait en phase 4 |
| envoyer en livraison, livrer | livraisons | fait en phase 4 |
| accepter une commande, changer son statut depuis sa fiche | fiche commande | **fait ici** |
| enregistrer un paiement | fiche commande, à traiter | **fait ici** |
| modifier une table | salle | **fait ici** |
| modifier les horaires | réglages | **fait ici** |
| réservations | réservations | **fait ici** |

Neuf écrans convertis dans cette phase, vingt au total dans le produit.

---

## Trois défauts de fond

### Un échec purement et simplement ignoré

Dans le centre d'alertes — l'écran « À traiter », ouvert toute la journée en
service — marquer un appel de salle comme traité s'écrivait ainsi :

```ts
try { await api.patch(...); … }
catch {
  // Un échec ponctuel laisse l'alerte visible : l'employé peut réessayer.
}
```

Le commentaire décrit une intention raisonnable et le code ne la réalise pas :
rien à l'écran n'apprend à l'employé qu'il y a quelque chose à réessayer.
L'appel reste affiché, sans explication, en plein service.

C'est le troisième de cette famille — les deux autres, sur la suppression
d'une dépense et d'un code promo, ont été corrigés en phase 5. Une relecture de
tous les `catch {}` du produit a été faite : les autres sont légitimes et
documentés (stockage local indisponible en navigation privée, lecture audio
bloquée avant interaction, à-coup de sondage, presse-papiers refusé, image de
code-barres illisible entre deux mouvements).

### Une décision d'argent qui ne disait pas laquelle avait été prise

Valider ou refuser une preuve de paiement Mobile Money se fait avec deux
boutons côte à côte. Une fois l'un des deux pressé, la ligne disparaît de la
liste — et rien ne dit lequel a été enregistré. Or les deux issues sont
opposées : l'une encaisse, l'autre laisse la commande impayée.

Les deux écrans concernés — le centre d'alertes et la fiche commande — le
confirment maintenant, montant à l'appui pour la validation.

### Une erreur de la phase 5, rattrapée ici

Le rapport de la phase 5 affirmait que les écrans Dépenses et Promotions
« servent aux deux produits et sont couverts des deux côtés ». C'était faux.

Il existe **deux implémentations distinctes portant le même nom** —
`components/boutique/expenses-manager` et `components/dashboard/expenses-manager`,
de même pour les promotions. Le constat venait d'une recherche sur le nom du
composant dans les pages, qui trouvait bien les deux produits, sans vérifier
d'où chacun l'importait. La phase 5 n'avait donc corrigé que les versions
Boutique ; les versions Restaurant sont converties ici, et
`docs/UX-BOUTIQUE.md` porte la rectification.

Leur gestion d'erreur, en revanche, était correcte : le `catch` manquant ne
concernait bien que les copies Boutique.

### Deux entrées de menu à une lettre d'écart

« Livraison » et « Mes livraisons » cohabitaient dans deux sections
différentes. La première règle les zones et les frais, la seconde est l'écran
de tournée du livreur. La première s'appelle maintenant **Zones et frais de
livraison**, et sa page avec elle.

---

## Affichage anticipé : la salle

Le badge d'une table bascule dès l'appui — libre → occupée → à nettoyer.

C'est un geste fait en passant devant la table, sans regarder l'écran plus
d'une seconde. Attendre le serveur pour voir la pastille changer conduit à
réappuyer, donc à **sauter un cran dans le cycle** et à annoncer un mauvais
statut au reste de l'équipe. C'est le seul des trois affichages anticipés du
produit dont l'absence provoquait une erreur de données, et non seulement une
gêne.

---

## Ce que le module a gagné

`useServerMutation` expose désormais `fieldErrors` : les refus qui portent sur
un champ précis s'affichent sous ce champ, et non dans un bandeau général.

Le serveur valide toujours, quoi qu'ait fait le navigateur — lui seul sait
qu'une date tombe un jour de fermeture ou qu'un nom est déjà pris. Sans cette
table, un refus de ce genre n'apparaissait que comme une phrase au-dessus du
formulaire, à charge pour la personne de deviner quel champ reprendre. Deux
écrans l'utilisaient déjà avec leur propre code ; ils passent par le module.

### Une confirmation qui reste sous le bouton

Les réglages font exception à la règle du message flottant. On y enregistre
plusieurs panneaux à la suite, et un message qui disparaît au bout de quatre
secondes laisse ensuite douter de ce qui a été pris en compte. La confirmation
reste donc affichée sous le bouton jusqu'à la modification suivante — c'était
déjà le cas, et cela n'a pas été remplacé par un toast.

---

## Audit de sécurité de la phase

Vérifié, aucune faille introduite.

**Les vingt écrans utilisant le module rendent tous sous un fournisseur de
messages.** Vérifié un par un, en remontant de chaque composant à la page qui
le rend et de la page à son layout.

**L'affichage anticipé du statut de table ne contourne rien.** Il est visuel et
côté navigateur ; le serveur reste seul juge, et un refus fait revenir la
pastille à son état réel avec un message.

**Les erreurs par champ ne révèlent rien de neuf.** Elles proviennent de
`fieldErrors` déjà présent dans l'enveloppe de réponse, déjà affiché par deux
écrans, et déjà produit par la validation Zod — nommer un champ invalide
n'expose pas la structure interne.

**Les échecs désormais visibles utilisent la même enveloppe** que partout
ailleurs. Ce qui change, c'est qu'ils cessent d'être muets.

**Le renommage ne touche ni adresse, ni permission.** L'entrée « Zones et frais
de livraison » garde sa permission `delivery:manage`.

---

## Ce que cette phase n'a pas couvert

Huit écrans du côté Restaurant conservent l'ancien enchaînement : galerie,
équipe, apparence, atelier photo, réglages de livraison, purge du journal, le
parcours d'abonnement, et le panneau des domaines personnalisés à l'intérieur
des réglages. Aucun n'est un écran de service : ce sont des écrans de
configuration, ouverts à l'installation puis rarement. Ils rejoindront les
phases qui les concernent — la livraison en phase 8, les domaines en phase 12,
les photos en phase 15.

Deux `router.refresh()` restants ne sont pas des oublis et ne doivent pas être
convertis : celui du `shell`, qui suit un changement de commerce actif, et
celui de l'`alert-watcher`, qui réagit à l'arrivée d'une commande — aucun des
deux ne part d'un appui sur un bouton.

Il reste 98 `router.refresh()` nus dans le produit, contre 133 au début de la
phase 4.
