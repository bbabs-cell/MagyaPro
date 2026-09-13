# Templates Restaurant — phase 14

Le §20 demande sept modèles de vitrine réellement distincts, et le §17 que le
site public parle la langue du visiteur. Les deux existaient — séparément. Mis
bout à bout, ils ne tenaient pas : **un visiteur qui passait le site en anglais
ou en arabe voyait la carte, le panier et le suivi de commande traduits, et
toute la page d'accueil en français.**

Aucune migration n'a été nécessaire.

---

## Ce qui n'était pas traduit

Le sélecteur de langue existe, le dictionnaire existe, les pages de commande
l'utilisent. Les sept templates, non : leurs textes étaient écrits directement
dans le JSX.

Le tableau donne, par fichier, le nombre de clés de dictionnaire **distinctes**
qu'il lit aujourd'hui — donc le nombre de textes qui étaient figés en français
(quelques-uns apparaissaient à plusieurs endroits) :

| fichier | clés distinctes lues |
|---|---|
| `index.tsx` — les 7 héros et les grilles de menu | 14 |
| `elegant-home.tsx` | 22 |
| `street-food-home.tsx` | 25 |
| `prestige-home.tsx` | 16 |
| `street-food-menu-filter.tsx` | 6 |
| `gallery-lightbox.tsx` et `offer-countdown.tsx` | 7 |

Le bloc `templates` du dictionnaire compte **62 clés**, dans chacune des trois
langues. La pastille « ouvert / fermé » en apporte six à elle seule.

Le bouton principal de chaque page d'accueil — « Commander maintenant » — en
faisait partie. C'est le seul mot qui compte sur cette page.

### Les libellés de badge

`BADGE_LABELS` était une **constante de module** : `POPULAR: 'Populaire'`,
évaluée une fois au chargement du fichier, donc impossible à faire varier
selon la langue. Elle est devenue `badgeLabels(dict)`.

C'est la même erreur de forme que les `useState` figés de la phase 4 : une
valeur calculée trop tôt, à un endroit qui ne peut plus rien apprendre.

### Le mécanisme retenu

Les quatre templates rendus côté serveur lisent le dictionnaire avec
`getServerDictionary()` ; les trois composants clients passent par
`useI18n()`, déjà en place.

Les sous-composants rendus **dans une boucle** — les cartes de plat — reçoivent
le dictionnaire **en paramètre** plutôt que de le lire eux-mêmes. Les rendre
`async` aurait fonctionné, mais aurait relu le dictionnaire une fois par plat
affiché : une trentaine de lectures inutiles sur une carte moyenne.

---

## Le défaut trouvé en chemin

**`computeOpenState` écrivait ses six phrases en français, en dur.**

C'est la pastille « Ouvert · ferme à 22:00 » qui apparaît sur les sept
templates, sur la page d'informations, et dans le héros de chaque vitrine.
Elle échappait à la traduction parce qu'elle n'est pas rendue par un
composant : elle est calculée dans une fonction de la couche métier, où
personne ne va chercher du texte à traduire.

La fonction prend maintenant ses libellés en paramètre. Elle reste **pure** —
elle ne lit ni cookie ni dictionnaire — ce qui est la raison pour laquelle elle
peut être testée sans rendu.

### Les noms de jours

`DAY_NAMES` était une liste française recopiée. Plutôt que d'en écrire deux
autres, le site public passe par `dayNames(locale)`, qui les demande à `Intl` —
présent dans Node comme dans tout navigateur, gratuit, et déjà correct en
arabe. **Une liste de moins à maintenir, et aucune langue à ajouter le jour où
une quatrième arrive.**

Le tableau de bord garde `DAY_NAMES` : il reste en français, c'est l'outil du
restaurateur et non sa vitrine.

---

## Les sept templates restent distincts

Le §20 insiste sur ce point, et la traduction ne l'a pas entamé : chaque
template garde son héros, sa grille et son vocabulaire visuel. `elegant`,
`prestige` et `street-food` gardent leur page unique qui défile ; les quatre
autres gardent la structure accueil courte + `/menu`.

Aucun texte n'a été uniformisé entre templates au passage. « Notre sélection »
(prestige) et « Notre menu » (street-food) restent deux clés distinctes : ce
sont deux registres différents, pas une répétition à factoriser.

---

## Audit de sécurité de la phase

**Aucune donnée nouvelle n'est lue ni écrite.** La phase remplace des chaînes
littérales par des lectures de dictionnaire. Les requêtes, les protections
d'accès et les données affichées sont inchangées.

**La langue vient d'un cookie, et ne donne accès à rien.** `resolveLocale()`
valide la valeur lue contre la liste des langues connues et retombe sur le
français sinon ; une valeur forgée ne fait donc pas sortir du dictionnaire.
Le cookie ne participe à aucune décision d'autorisation.

**Le remplissage des gabarits ne rend pas de HTML.** `fill()` substitue
`{time}` et `{day}` dans une chaîne, et le résultat est rendu par React, qui
échappe. Les valeurs substituées viennent des horaires du restaurant et des
noms de jours d'`Intl`, jamais du visiteur.

**`dayNames()` ne peut pas faire échouer une page publique.** Une langue
inexploitable ferait lever `Intl` ; l'appel est entouré d'un `catch` qui
retombe sur la liste française. C'est la même précaution que `computeOpenState`
prend déjà pour un fuseau horaire invalide en base.

**Le tenant reste résolu côté serveur.** Les templates reçoivent les données
d'un restaurant déjà résolu depuis l'hôte par `resolvePublicRestaurant`. Rien
de ce qui a été touché ici ne prend d'identifiant de commerce.

---

## Tests

`tests/opening-hours.test.ts` — 9 tests, sans base de données :

- une langue demandée ne peut pas ressortir en français ;
- le fuseau du restaurant l'emporte sur celui du serveur ;
- un fuseau invalide en base ne fait pas échouer le rendu ;
- aucun gabarit `{time}` / `{day}` ne survit non remplacé ;
- les sept jours sont rendus, distincts et non vides, dans les trois langues.

`tests/dictionary.test.ts`, écrit en phase 7, vérifiait déjà que les trois
langues portent exactement les mêmes clés. Il a servi à chaque ajout de cette
phase : les ~20 clés nouvelles sont présentes dans les trois.

**Suites pures : 15 fichiers, 135 tests, tous au vert.** Les suites qui
demandent PostgreSQL n'ont pas pu tourner dans cet environnement.

---

## Ce que cette phase n'a pas couvert

**Le contenu saisi par le restaurateur.** Le nom des plats, les descriptions et
l'histoire de la maison passent par `localize()`, qui n'affiche une traduction
que si le restaurateur l'a saisie. C'est le bon comportement — mais rien dans
le tableau de bord n'indique *combien* de champs restent à traduire.

**Le tableau de bord.** Il reste en français, comme décidé au départ.

**Le sens de lecture en arabe.** Les templates utilisent déjà les propriétés
logiques (`ms-2`, `text-start`) plutôt que `ml-2` / `text-left`, donc la
bascule droite-à-gauche fonctionne. Elle n'a pas été vérifiée à l'œil sur les
sept modèles — c'est un point à reprendre en phase 17 (responsive et design).

**Le test humain.** Ouvrez une vitrine, passez la langue en anglais puis en
arabe, et parcourez les sept templates. Ce qui doit changer : tous les textes
de l'interface, y compris la pastille d'ouverture et les jours de la semaine.
Ce qui doit rester tel quel : les noms de plats non traduits par le
restaurateur.
