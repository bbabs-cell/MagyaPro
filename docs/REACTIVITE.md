# Réactivité — phase 4

Ce que l'utilisateur ressent comme de la lenteur n'en est presque jamais.
C'est un écran qui ne dit pas ce qu'il fait.

---

## Le défaut principal : sept écrans figés

C'est la découverte de la phase, et elle dépasse largement une question de
confort.

Sept écrans de gestion recopiaient les données reçues du serveur dans un état
local dont le setter n'était jamais utilisé :

```ts
const [products] = useState(initialProducts);
```

`useState` ne lit sa valeur initiale **qu'au premier rendu**. Tous les rendus
suivants l'ignorent. La liste restait donc gelée sur son contenu de l'ouverture
de la page — définitivement.

Ces mêmes écrans appelaient `router.refresh()` après chaque enregistrement. Le
serveur refaisait donc consciencieusement son travail, renvoyait des données à
jour… que rien n'affichait. Un produit créé, un prix corrigé, une ligne
supprimée n'apparaissaient qu'après un rechargement complet du navigateur.

Écrans concernés : produits, menu, achats, clients, dépenses, promotions —
c'est-à-dire l'essentiel du travail quotidien des deux produits.

Le défaut est invisible au typage : le programme est valide. Il est presque
invisible à la lecture : la ligne ressemble à une déclaration d'état ordinaire.
`tests/reactivity.test.ts` relit désormais le code source et échoue si
l'écriture réapparaît.

---

## Le défaut de fond : le bouton ment sur son propre état

La séquence écrite partout dans le produit :

```ts
setPending(true);
try { await api.patch(...); router.refresh(); }
finally { setPending(false); }
```

`router.refresh()` ne rend pas la main quand l'écran est à jour. Il *demande*
au serveur de refaire le rendu et revient immédiatement. Le `finally` s'exécute
donc alors que la réponse n'est pas arrivée.

Sur un téléphone en 3G, ce que vit le commerçant :

1. il appuie sur « Marquer prête » ;
2. le bouton tourne, puis **s'arrête** ;
3. la commande affiche toujours l'ancien statut — pendant une à deux secondes,
   l'écran annonce que c'est fini et montre le contraire ;
4. le contenu saute d'un coup.

Entre 2 et 4, le bouton est réactivé. Un commerçant pressé rappuie, et l'action
part une seconde fois.

### Mesure d'entrée de phase

| | Avant |
|---|---|
| `router.refresh()` | 133 appels, 70 fichiers |
| `useTransition` | 0 |
| `useOptimistic` | 0 |

Le mécanisme de mise à jour fonctionnait. Il était muet.

---

## Ce qui a été fait

### Une règle unique : `useServerMutation`

`src/lib/client/use-server-mutation.ts`. L'appel réseau **et** le
rafraîchissement se déroulent dans une même transition React : `pending` reste
vrai jusqu'à ce que le nouveau rendu soit affiché, pas jusqu'à ce que la
requête soit partie. Le bouton tourne exactement le temps de l'attente et reste
inactif pendant tout ce temps.

La règle est écrite une fois. Les écrans décrivent ce qu'ils font, pas comment
attendre.

### Affichage anticipé là où l'attente coûte cher

Trois écrans montrent le résultat **dès l'appui**, sans attendre le serveur :

- **commandes** — le badge de statut et la colonne paiement ;
- **cuisine** — la fiche part dans la colonne suivante ;
- **menu** — « Marquer épuisé » bascule immédiatement.

Ce ne sont pas des affichages inventés. React tient la valeur anticipée le
temps de la transition puis la remplace par la réponse réelle : en cas de
refus, l'écran revient de lui-même à l'état d'avant et l'erreur s'affiche.
Jamais l'écran ne reste sur une valeur que la base ne porte pas.

Tant que l'anticipation n'est pas confirmée, la ligne concernée est en opacité
réduite et porte `aria-busy`. Une commande affichée « Payé » par anticipation
doit rester distinguable d'une commande réellement encaissée.

**Une exception délibérée : les livraisons.** « Prendre cette livraison » est
une course entre livreurs — deux d'entre eux peuvent viser la même commande.
Rien n'est déplacé d'avance : le serveur tranche, et lui seul. Annoncer au
perdant une course qu'il n'a pas obtenue serait pire que de le faire attendre.

### Deux courses corrigées

Les écrans cuisine et livraison interrogent le serveur toutes les douze à
quinze secondes. Une réponse partie **avant** un appui arrive **après** lui et
rapporte l'état d'avant. La course tout juste prise réapparaissait dans la
liste « à prendre », et le livreur la reprenait — ou croyait l'avoir perdue au
profit d'un collègue. Le relevé périodique est désormais suspendu tant qu'une
action est en vol.

### La caisse ne se fige plus sur un `window.alert`

L'écart constaté à la fermeture s'affichait dans une boîte native. Elle gèle la
page — le rafraîchissement lancé juste avant restait suspendu tant que le
caissier n'avait pas appuyé sur « OK » — et son contenu disparaissait
définitivement à la fermeture. Or un écart de caisse est précisément le chiffre
qu'on veut relire, noter, montrer au patron. Il s'affiche maintenant dans la
barre, avec le compté et l'attendu, jusqu'à ce que le caissier l'écarte.

### Un bandeau d'erreur au lieu de cinquante

La même boîte rouge était réécrite à la main dans une cinquantaine d'endroits,
avec des marges et des nuances qui divergeaient déjà. `AlertMessage` la porte
une fois.

---

## Où en est la conversion

| | Avant | Après |
|---|---|---|
| Écrans figés | 7 | 0 |
| `router.refresh()` nu | 133 | 125 |
| Écrans à attente honnête | 0 | 8 |
| Affichage anticipé | 0 | 3 |

Les huit écrans convertis sont ceux qu'un commerçant touche tous les jours :
commandes, cuisine, livraisons, caisse, encaissement, achats, produits, menu.

**Les 125 appels restants ne sont pas un oubli.** Ils portent le même défaut
d'attente, à un degré moindre — ce sont des écrans de réglage, ouverts une fois
par mois, où une seconde d'incertitude ne coûte pas une commande. Les convertir
demande d'ouvrir et de reparcourir chacun d'eux : fait à l'aveugle et en série,
le remède serait pire que le mal. La règle existe, ils s'y rattacheront au fur
et à mesure des phases qui les concernent.

---

## Audit de sécurité de la phase

Vérifié, aucune faille introduite.

**Les messages d'erreur affichés plus largement ne fuient rien.** Le bandeau
reprend le message du serveur. Tous les chemins ont été relus dans
`toErrorResponse` : ce message est soit une erreur applicative rédigée pour un
commerçant, soit une phrase fixe, soit le 500 générique. Requêtes SQL, chemins
de fichiers et structure interne partent dans les journaux et Sentry, jamais
dans la réponse.

**L'affichage anticipé ne contourne aucun contrôle.** Il est purement visuel et
côté navigateur ; le serveur décide seul, et le refus fait revenir l'écran en
arrière. Aucune donnée n'est écrite sans passer par la route habituelle.

**Le dégel des données ne montre rien de nouveau.** Le serveur choisit déjà ce
qu'il envoie, écran par écran. Afficher ces données plutôt que de les ignorer
ne change aucun droit — et joue plutôt dans le bon sens : un accès retiré se
reflète maintenant sans rechargement.

**Aucune injection possible par les nouveaux affichages.** Le bandeau d'erreur
et le relevé de caisse rendent du texte ; React échappe. Le `window.alert`
supprimé n'est remplacé par aucun rendu de HTML.

---

## Ce que cette phase n'a pas couvert

La vitesse réelle du serveur — requêtes, index, taille des réponses. Cette
phase portait sur ce que l'écran raconte pendant l'attente, pas sur la durée de
l'attente elle-même. Le poids du JavaScript envoyé au premier chargement est
inchangé : 103 ko partagés.
