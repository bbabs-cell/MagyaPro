# Design system et responsive — phase 17

Deux sujets : la typographie, qui attendait un arbitrage de votre part, et
l'état réel du responsive, qui demandait une vérification plutôt qu'une
refonte.

Aucune migration n'a été nécessaire.

---

## La décision typographique

Le §6 demandait Manrope pour le corps de texte. Le produit était sur la pile
système, avec un raisonnement écrit dans `DESIGN.md` : zéro octet téléchargé
pour le texte le plus volumineux, sur des téléphones à connexion irrégulière.

**Vous avez tranché pour Manrope**, en connaissance du coût. C'est appliqué.

Ma recommandation était l'inverse ; elle n'a pas changé, mais l'arbitrage vous
revient et le §6 est explicite. Ce que la phase pouvait encore faire, c'est
réduire le coût autant que le format le permet.

### Ce que ça coûte, mesuré

| | avant | après |
|---|---|---|
| police du corps de texte | 0 Ko | **24 Ko** (sous-ensemble latin, préchargé) |
| polices déjà chargées | Bricolage Grotesque 44 Ko, DM Mono 32 Ko | inchangées |

Le chiffre de 24 Ko est relevé dans le build, pas estimé : c'est le fichier
`woff2` du sous-ensemble latin que reçoit un visiteur francophone. Les autres
sous-ensembles existent mais ne sont pas demandés.

### Les trois précautions

**Sous-ensemble latin seulement.** Manrope ne dessine pas l'arabe ; charger
d'autres sous-ensembles alourdirait sans rien résoudre.

**`display: swap`.** Le texte est lisible immédiatement dans la police de
l'appareil, puis bascule. L'alternative, `optional`, éviterait le ressaut mais
priverait une partie des visiteurs de Manrope — ce qui viderait votre décision
de son sens.

**Police auto-hébergée.** `next/font` télécharge le fichier au moment du build
et le sert avec le reste de l'application. Aucune requête vers un fournisseur
tiers, donc **aucune adresse IP de visiteur transmise ailleurs** au chargement
d'une page.

### Le ressaut est amorti, et c'est vérifié

Le §6 s'opposait au §8 (rapidité perçue) : une police qui arrive après coup
fait sauter la mise en page.

`next/font` génère une famille de repli aux métriques ajustées —
`Manrope Fallback`, avec `size-adjust: 103,19 %` et des surcharges
d'ascendante et de descendante. La police système est donc redimensionnée pour
occuper la même place que Manrope. Le texte change de dessin en cours de
chargement, mais **ne se déplace pas**.

C'est relevé dans le CSS produit par le build, pas supposé.

### L'arabe

Ni Manrope ni Bricolage Grotesque ne couvrent l'arabe. C'est pourquoi la pile
système reste **derrière** les deux plutôt que d'être remplacée : le navigateur
bascule glyphe par glyphe, et un texte arabe est dessiné par la police du
système sans qu'aucune règle CSS n'ait à le prévoir.

### Les sites publics ne changent pas

Les vitrines des restaurants remplacent `--font-sans` par la police choisie par
le commerçant, chargée depuis Google Fonts par leur propre mise en page. Manrope
ne s'y applique pas et n'avait pas à s'y appliquer : c'est la typographie du
restaurant, pas celle de MagyaPro.

C'est aussi pourquoi `globals.css` passe par `var(--font-manrope)` et n'écrit
pas « Manrope » en dur — un nom en dur casserait cette substitution. Un test le
vérifie.

### Une règle du design system a été réécrite

`DESIGN.md` portait **« la règle du corps natif »**, qui prescrivait exactement
l'inverse de ce qui vient d'être fait. Elle est remplacée par **« la règle de
la famille réellement chargée »**, qui garde ce qui reste vrai : une famille
nommée dans ce fichier doit être une famille effectivement téléchargée.

Le raisonnement de l'ancienne règle n'a pas été effacé — il est conservé dans
la section **Character**, où il explique ce que la décision coûte. Une
documentation qui tait le prix d'un choix est moins utile qu'une documentation
qui l'assume.

---

## Le garde de typographie

Cette règle a déjà été enfreinte : « Inter » a figuré en tête de la pile
pendant longtemps **sans être téléchargée nulle part**. Elle ne s'affichait donc
que chez les visiteurs l'ayant installée sur leur machine — presque personne —
et la documentation décrivait une typographie inexistante.

Rien dans le typage ni à l'écran ne détecte cela : une police absente est
silencieusement remplacée par la suivante de la pile.

`tests/typography.test.ts` compare donc la documentation au code de
chargement : toute famille citée dans les jetons de `DESIGN.md` doit être
importée par `src/lib/fonts.ts`, sauf les familles génériques et natives, que
le système fournit. Il vérifie aussi que chaque pile garde un repli, et que le
corps de texte passe bien par la variable.

**J'ai vérifié qu'il mord** en replantant exactement la régression historique —
« Inter » dans les jetons, absente de `fonts.ts`. Le test échoue.

---

## Le responsive : vérifié, une seule correction

Contrairement aux phases précédentes, l'audit n'a pas produit de longue liste.
Le produit est en bon état sur ce point, et je préfère le dire que d'inventer
des trouvailles.

**Ce qui a été vérifié :**

| point | résultat |
|---|---|
| tableaux sans protection en largeur | **1 réel** (corrigé), 1 faux positif |
| largeurs fixes en pixels | aucune |
| largeurs minimales bloquantes | une seule, en pourcentage, sans risque |
| cibles tactiles sous 44 px | aucune sur les écrans conçus pour le téléphone |
| couleurs hors jetons | uniquement une illustration marketing, volontaire |

**Les tableaux.** Le produit a deux mécanismes : `table-stack`, qui transforme
un tableau en cartes empilées sur mobile, et le défilement horizontal. Tous les
tableaux des tableaux de bord et de l'administration en portent un.

Deux échappaient au filet. L'un est un tableau `sr-only` — un équivalent
textuel de graphique, invisible, qui ne peut pas déborder. L'autre était réel :
**le tableau de lignes des factures et reçus**, quatre colonnes de prix qui ne
rentrent pas sur un téléphone étroit.

Un document ne peut pas être empilé comme un tableau de bord — c'est une
facture, elle garde sa forme. Il défile donc horizontalement dans son propre
cadre plutôt que de pousser la page entière. `overflow-x` n'a aucun effet à
l'impression, où le contenu est paginé et non contraint par une fenêtre : la
mise en page papier est intacte.

**Les cibles tactiles.** Le bouton standard fait 44 px de haut, le format
compact 36 px. J'ai vérifié les écrans conçus pour le téléphone — la caisse et
l'écran cuisine : **aucun n'utilise le format compact**. Il n'y avait donc rien
à corriger, seulement à constater.

**Les jetons.** Le composant `Card` est utilisé 157 fois ; les 25 cartes
écrites à la main sont presque toutes sur les vitrines publiques et les pages
marketing, qui ne partagent délibérément pas les composants du tableau de bord.
Ce n'est pas une dérive, c'est une frontière.

---

## Audit de sécurité de la phase

**Une dépendance réseau en moins, pas une de plus.** Manrope est téléchargée au
build et servie depuis le même domaine que l'application. Contrairement à un
lien vers un fournisseur de polices, aucune requête de visiteur ne part vers un
tiers, et aucune adresse IP n'est exposée.

**Aucune donnée, aucune route, aucun contrôle d'accès n'est touché.** La phase
modifie une déclaration de police, un conteneur de mise en page et de la
documentation.

**Le changement de police ne peut pas révéler d'information.** Une police est
un fichier statique, identique pour tous les visiteurs, sans lien avec le
commerce consulté.

**Le défilement du tableau de document ne change pas ce qui est affiché.** Les
mêmes lignes, les mêmes montants, les mêmes protections d'accès sur les trois
pages de document.

---

## Tests

`tests/typography.test.ts` — 4 tests, sans base ni navigateur, dont un vérifié
en replantant la régression historique.

**Suites pures : 19 fichiers, 177 tests, tous au vert.** Les deux échecs
restants sont les tests de limitation de débit, qui demandent PostgreSQL.

---

## Ce que cette phase n'a pas couvert

**La vérification visuelle réelle.** Je n'ai pas de navigateur utilisable ici —
l'application demande PostgreSQL, absent de cet environnement. Tout ce qui
précède est relevé dans le code et dans le build, jamais à l'écran. Un
débordement causé par un contenu long et non par une classe CSS m'échapperait.

**Le sens de lecture en arabe, à l'œil.** Les propriétés logiques sont
utilisées partout (`ms-2`, `text-start`), donc la bascule droite-à-gauche
fonctionne en principe. Elle n'a toujours pas été regardée sur les sept
modèles — c'est le même point que la phase 14 laissait ouvert.

**Le test humain — celui-ci compte plus que d'habitude.** Ouvrez le tableau de
bord sur un téléphone, **en 3G ralentie**, et rechargez. Vous devez voir le
texte apparaître immédiatement dans la police du téléphone, puis basculer sur
Manrope **sans que rien ne se déplace**. Si la mise en page saute, le repli aux
métriques ajustées ne fonctionne pas et il faudra le regarder.

Ouvrez ensuite une facture sur le même téléphone : le tableau des lignes doit
défiler horizontalement tout seul, sans emporter la page avec lui. Puis
imprimez-la pour vérifier que le papier n'a pas changé.
