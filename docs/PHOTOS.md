# Direction photographique — phase 15

Le §21 demande une direction photographique. Vous avez tranché la question
préalable : **outillage produit et briefs**, pas d'images générées ni de photos
de banque. C'est le bon choix pour une raison qui n'est pas seulement
budgétaire — un client qui commande d'après une image qui ne correspond à rien
reçoit autre chose que ce qu'il a vu.

La direction photographique prend donc deux formes : ce que le produit
**impose** aux photos réelles du commerçant, et ce qu'il lui **explique**, à
l'endroit et au moment où il choisit la photo.

Aucune migration n'a été nécessaire.

---

## Le défaut principal

**Le restaurateur téléversait une photo sans jamais voir ce qui en serait
coupé.**

Une même photo de plat est affichée par les sept modèles de site dans des
proportions différentes, toutes en `object-cover`, qui rogne depuis le centre :

| affichage | proportion | où |
|---|---|---|
| carré | 1,00 | street-food, grille rapide |
| 4:3 | 1,33 | traditional, fiche du plat |
| cellule bento, mobile | ≈ 0,92 | grille deux colonnes |
| cellule bento, bureau | ≈ 1,52 | grille quatre colonnes |

Une assiette cadrée un peu haut disparaissait à moitié sur un modèle et pas sur
un autre — sans que rien ne le signale, ni avant, ni après.

### Ce qui survit vraiment

`src/lib/images/framing.ts` calcule la part de l'image visible dans **tous** les
affichages d'un rôle. Ce n'est pas une estimation : c'est de la géométrie, et
elle est testée.

Pour une photo de plat cadrée en 5:4, la zone conservée partout est de
**74 % en largeur et 82 % en hauteur**. C'est ce rectangle que le nouvel écran
de cadrage affiche en pointillés.

Le ratio de cadrage n'est pas choisi à l'estime non plus. Le pire rognage
horizontal vient du cadre le plus étroit, le pire rognage vertical du plus
large ; la source qui équilibre les deux est la **moyenne géométrique** des
extrêmes — pas la moyenne arithmétique, car des proportions se composent en
multipliant. Pour les plats elle vaut 1,18 ; 5:4 = 1,25 est le repère nommable
le plus proche.

Détail agréable et vérifié par les tests : arrondir vers un repère nommable ne
coûte **aucune surface**. Cela déplace la zone sûre — un peu plus haute, un peu
moins large — sans en réduire l'aire. Le restaurateur y gagne un repère qu'il
comprend, et n'y perd rien.

---

## Ce que le produit impose maintenant

**Un écran de cadrage avant l'envoi.** La photo choisie s'affiche dans son
cadre définitif, avec la zone sûre en pointillés et deux aperçus montrant les
deux proportions les plus éloignées — donc les deux qui coupent le plus. Le
commerçant fait glisser la photo pour placer son sujet, et **ce qu'il valide
est ce qui sera servi** : le recadrage est appliqué au fichier.

Le recadrage et la réduction se font en une seule passe, pour ne pas
ré-encoder deux fois. Comme la réduction écrite en phase 13, l'opération
**n'échoue jamais** : si le navigateur ne sait pas décoder le fichier, il part
tel quel. Un envoi non recadré vaut mieux qu'un envoi impossible.

L'écran est branché sur les **huit** points de téléversement du tableau de
bord : le logo à l'inscription ; logo, favicon, couverture et photo du chef
dans l'apparence ; les photos de plats dans la carte ; la galerie ; et l'image
de partage dans les réglages.

**L'import en lot ne demande rien.** L'atelier photo accepte vingt fichiers
d'un coup ; il ne peut pas demander vingt arbitrages. Il applique un cadrage
centré, ce qui suffit à rendre la grille régulière. Le réglage fin reste
possible plat par plat.

---

## Ce que le produit explique

`src/lib/images/briefs.ts` porte un brief par rôle : l'intention en une phrase,
trois ou quatre consignes à l'impératif, et les erreurs fréquentes. Pas de
vocabulaire de photographe, et rien sur ce que le produit fait déjà — le poids
et les dimensions ne sont pas l'affaire de l'utilisateur.

> Près d'une fenêtre, en journée, sans allumer le plafonnier.
> Assiette au centre, vue de trois quarts plutôt qu'à la verticale.
> Fond uni : une table en bois, une nappe claire, un plateau.
> Le plat tel qu'il part en salle — même portion, même dressage.

La ligne de cadrage, elle, est **calculée** et non rédigée. Si un template
change ses proportions demain, la consigne change avec lui plutôt que de
devenir fausse en silence. Un test le vérifie.

Les briefs sont affichés dans l'écran de cadrage et dans l'atelier photo — pas
dans un document séparé, qui ne serait pas lu.

---

## Deux défauts trouvés en chemin

**La galerie était cadrée pour rien.** Ses photos sont rangées dans le dossier
des couvertures, et le rôle était déduit du dossier : elles auraient été
cadrées en 3:2 alors que la galerie les affiche **en carré**. Un tiers de la
largeur aurait été jeté deux fois — une fois au cadrage, une fois à
l'affichage. Le rôle est désormais explicite là où le dossier ne suffit pas à
le deviner.

Son texte d'aide disait d'ailleurs « format paysage recommandé » pour un
affichage carré. Il est corrigé.

**L'image de partage n'est pas une couverture.** Elle était rangée avec les
images SEO et traitée comme une couverture. C'est une carte 1,91:1 — la
proportion attendue par les messageries, qui rognent sans pitié tout ce qui
s'en écarte. Elle a maintenant son propre rôle et son propre brief.

---

## Le compromis qui reste, et qu'aucun outil ne résoudra

**La photo de couverture est affichée en 21:9 par un template et en 4:5 par un
autre.** Sa zone sûre n'est que de **53 % × 64 %**, soit un tiers de la surface.

Ce n'est pas un défaut de calcul, c'est une contradiction de conception : rien
ne peut être à la fois un bandeau panoramique et un portrait. Trois issues
possibles, aucune gratuite :

1. rapprocher les proportions des deux templates — c'est un choix de design,
   à faire en phase 17 ;
2. demander deux photos de couverture, une par orientation — plus de travail
   pour le commerçant ;
3. accepter la zone sûre étroite et le dire, ce qui est fait aujourd'hui.

Je n'ai pas tranché seul : cela toucherait l'identité visuelle de deux
templates, ce qui dépasse le cadre d'une phase sur la photographie.

---

## Audit de sécurité de la phase

**Tout le traitement d'image reste sur l'appareil du commerçant.** Décodage,
recadrage et ré-encodage passent par le canvas du navigateur. Aucun service
tiers, aucun envoi supplémentaire, aucun coût à l'usage.

**L'aperçu ne téléverse rien.** L'image affichée pendant le cadrage est un
objet local ; rien ne part avant validation. L'URL d'objet est révoquée au
démontage du composant — sans quoi chaque photo examinée resterait en mémoire
jusqu'au rechargement de la page.

**Les protections du téléversement sont inchangées.** La route valide toujours
la taille et la signature binaire du fichier, applique une limitation de débit,
exige la permission `restaurant:update`, et range le fichier sous
l'identifiant du restaurant **issu de la session** — jamais sous un
identifiant envoyé par le client.

**Le recadrage côté client n'est pas une protection et n'est pas traité comme
telle.** Un client modifié peut envoyer ce qu'il veut ; c'est la route qui
décide, et elle n'a pas changé. Le cadrage est une aide à la mise en page, pas
un contrôle.

**Aucune donnée nouvelle n'est stockée.** Le point de cadrage est appliqué au
fichier puis oublié : pas de colonne ajoutée, pas de migration.

---

## Tests

31 tests purs, sans base ni navigateur :

- `tests/framing.test.ts` (25) — la géométrie. Notamment deux propriétés
  vérifiées sur des balayages complets : `object-cover` ne rogne jamais les
  deux dimensions à la fois, et aucune proportion ne fait mieux que celle
  choisie. Le rectangle de recadrage ne sort jamais de l'image, y compris pour
  un point d'intérêt hors bornes et pour une image de 3 × 5000 pixels.
- `tests/photo-briefs.test.ts` (6) — chaque rôle a son brief, les
  pourcentages annoncés sont ceux qui sont calculés, et un rôle sans rognage
  ne se voit pas annoncer de zone sûre.

**Suites pures : 17 fichiers, 166 tests, tous au vert.** Les deux échecs
restants sont les tests de limitation de débit, qui demandent PostgreSQL,
absent de cet environnement.

J'ai vérifié que le test d'optimalité a des dents en y plantant volontairement
la mauvaise formule : il échoue bien. **Attention — la restauration du fichier
a d'abord échoué en silence** : `git checkout` ne peut rien restaurer d'un
fichier encore non suivi. J'ai remis la bonne formule à la main et vérifié la
ligne. C'est la deuxième fois que `git checkout` me joue ce tour dans ce
projet.

---

## Ce que cette phase n'a pas couvert

**La Boutique.** Le module de cadrage est écrit à partir des proportions
**relevées** dans les templates Restaurant. Les appliquer à une boutique sans
avoir mesuré les siennes produirait un guide faux, ce qui est pire que pas de
guide. Le travail est réutilisable tel quel : il faut relever les proportions
côté Boutique et ajouter les rôles.

Au passage : `src/components/boutique/image-upload-field.tsx` **n'est importé
nulle part**. Il rejoint le constat de la phase 13 — rien ne permet de
téléverser un logo côté Boutique, alors que le champ existe en base et
s'imprime sur les factures.

**Le point de cadrage persistant.** Le recadrage est destructif : la photo
stockée est déjà cadrée. Si le commerçant change de modèle de site, son
cadrage reste celui d'avant. Stocker un point d'intérêt plutôt que de rogner
(deux colonnes, et `object-position` sur chaque image) donnerait un meilleur
résultat — mais c'est une migration et une retouche de tous les templates.

**Le test humain.** Prenez une photo de plat volontairement mal cadrée, sujet
vers le bord. Téléversez-la : l'écran de cadrage doit montrer ce qui sort du
rectangle en pointillés, et les deux aperçus doivent la couper différemment.
Recentrez, validez, puis regardez la carte sur les sept modèles.
