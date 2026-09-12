# Rôle Cuisine — phase 9

Deux choses ici : le rôle demandé par le §18, et la faille I2 relevée à
l'audit de la phase 3, qui se referme du même geste.

Une migration a été nécessaire — une seule ligne, purement additive.

---

## 1. Il n'existait aucun rôle pour un cuisinier

Pour faire travailler quelqu'un sur l'écran de préparation, il fallait le
déclarer **« Employé »**. Ce rôle donne, dans le même geste :

- le fichier clients complet ;
- les réservations ;
- le plan de salle ;
- les livraisons ;
- la liste des commandes avec les coordonnées et les montants.

**Sept accès pour un poste qui en demande un.** C'est le défaut I2, et il ne
se corrigeait pas en rognant « Employé » : un serveur de salle a réellement
besoin des tables, des réservations et du fichier clients. Il manquait un rôle,
pas une permission.

Le rôle **Cuisine** ne porte que `orders:update_status` — il ouvre l'écran de
préparation et autorise les deux gestes du poste, démarrer un plat et le
marquer prêt. Pas `orders:view`, qui donnerait la liste complète des commandes.
Pas `orders:cancel`, qui n'est pas une décision de cuisine.

Comme le livreur, la cuisine reçoit un **espace à part** plutôt que la barre
latérale complète avec presque tout grisé — plus large que celui du livreur, ses
trois colonnes se lisant de loin sur un écran posé au mur.

### Une liste recopiée quatre fois

Les rôles attribuables étaient énumérés à la main dans quatre fichiers : le
sélecteur, la page Équipe, et **les deux schémas de validation** de
l'invitation et de la modification.

Quatre copies d'une même vérité, dont deux gardent la porte d'entrée. Ajouter
un rôle au sélecteur sans l'ajouter au schéma donne un choix que le serveur
refuse ; l'inverse donne un rôle que personne ne peut attribuer. Les quatre
lisent maintenant `ASSIGNABLE_ROLES`.

Deux composants déclaraient aussi la liste des rôles à la main dans leur
typage, au lieu d'utiliser le type de la base. Ces listes-là oublient
fatalement le rôle suivant, et l'oubli ne se voit qu'au moment où quelqu'un
porte ce rôle.

### Les descriptions viennent d'où les permissions sont définies

Le sélecteur de rôle décrivait chaque rôle avec un texte écrit sur place, à
côté de la case à cocher. Deux textes entretenus séparément finissent par se
contredire — et celui-ci est lu au moment précis où un propriétaire décide de
ce qu'un employé pourra voir. Les descriptions vivent désormais dans `rbac`,
avec les permissions qu'elles décrivent.

---

## 2. La cuisine ne voyait pas ce qu'elle devait préparer

C'est le défaut le plus concret de la phase, et il n'était pas dans l'audit.

**Les options choisies par le client étaient chargées depuis la base, typées
dans le composant… et jamais affichées.** « Sans piment », « bien cuit »,
« supplément fromage » n'atteignaient pas la personne qui cuisine.

**La remarque du client n'était même pas lue.** « Allergique aux arachides »,
« pas de sel » : la seule personne à qui ces phrases s'adressent ne les voyait
pas.

Les deux apparaissent maintenant, en évidence — les options sous chaque plat,
la remarque du client dans un encart à part.

### Le reste de la fiche

| Élément | Avant | Après |
|---|---|---|
| numéro de commande | dans la ligne, taille normale | en gros, seul en haut |
| quantité | `3 × Poulet` dans le texte | détachée, en gras, chiffres alignés |
| attente | `12 min`, gris | pastille orange au-delà de 15 minutes |
| destination | absente | table, livraison ou à emporter |
| bouton | 36 px | 44 px, la taille d'un doigt |

Le numéro est ce qu'on crie à travers une cuisine ; il mérite d'être la chose
la plus grosse de la fiche. La quantité est détachée du nom parce que « 3 × »
perdu au milieu d'une phrase se lit comme un « 8 » — et l'on prépare trois
plats de trop.

---

## 3. Une lecture en double, encore

Comme pour les livraisons en phase 8, la file de la cuisine existait deux
fois : dans la page, et dans la route que le même écran interroge toutes les
douze secondes.

Ce n'est pas théorique. Ajouter la remarque du client à la page seule l'aurait
fait apparaître à l'ouverture, puis **disparaître douze secondes plus tard**,
sans que personne comprenne pourquoi. Les deux passent par `lib/kitchen`.

C'est la troisième occurrence de ce motif. Il n'y en a plus dans le produit.

### Et une conversion qui n'en était pas une

Les options sont stockées en JSON, donc sans forme garantie. Les écrans les
lisaient avec un `as`, qui ne vérifie rien : une donnée mal formée passait pour
valide et s'affichait vide. `readOptions` écarte ce qui n'a pas la bonne forme
et rend le reste sûr à afficher. Sept tests, dont les cas d'une ligne
incomplète, de types faux, et d'une valeur qui n'est pas un tableau.

---

## Audit de sécurité de la phase

**La migration ne change les accès de personne.** Elle ajoute une valeur à une
énumération. Aucune ligne existante n'est modifiée, aucun rôle actuel ne change
de sens, et personne ne gagne ni ne perd d'accès tant qu'un propriétaire n'a
pas explicitement attribué le nouveau rôle.

**Le rôle Cuisine est vérifié par test, pas seulement par lecture.**
`tests/rbac-roles.test.ts` affirme qu'il ne porte que `orders:update_status` et
énumère nommément les onze permissions qu'il ne doit jamais reprendre — dont
les cinq qui posaient problème. Le test échouera si quelqu'un élargit le rôle
sans y penser, ce qui est précisément la manière dont ce genre de défaut
réapparaît.

**Les permissions supplémentaires restent bornées au catalogue.** Vérifié :
une valeur inventée envoyée par un client n'accorde rien.

**Aucune permission n'a été retirée à un rôle existant.** « Employé »,
« Administrateur » et « Propriétaire » sont inchangés : la correction consiste
à ajouter un rôle étroit, pas à rogner un rôle large dont d'autres postes ont
réellement besoin.

**Le contrôle d'accès de l'écran cuisine est inchangé** — il exigeait déjà
`orders:update_status`, et c'est exactement ce que le nouveau rôle accorde.

---

## Ce que cette phase n'a pas couvert

**Le rafraîchissement de l'écran Commandes.** Le §18 demande que « le
restaurant et le livreur voient l'information immédiatement » quand la cuisine
marque une commande prête. Pour le livreur, c'est acquis : sa tournée
s'actualise toutes les quinze secondes et une commande prête entre dans sa
file. Pour le restaurant, l'écran Commandes ne s'actualise que lorsque le
nombre d'alertes change — or passer en « prête » n'est pas une alerte. Ajouter
un sondage de plus à cet écran est une décision à prendre en mesurant, pas au
jugé ; je l'ai laissée de côté.

**Le test humain.** Créez un membre avec le rôle Cuisine, connectez-vous avec
son compte, et vérifiez que la barre latérale n'existe pas et qu'aucune autre
page ne s'ouvre.
