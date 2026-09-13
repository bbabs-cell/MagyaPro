# Responsive — phase 18

La phase 17 s'était terminée sur un aveu : « je n'ai pas pu regarder un seul
écran ». Pour une phase *sur* le responsive, c'était la limite à lever en
premier.

Elle l'a été. PostgreSQL est installé sur cette image, Chromium aussi :
l'application a été construite, lancée, remplie de données de démonstration, et
**mesurée dans un vrai navigateur** à quatre largeurs.

Le résultat justifie le détour. Les cinq défauts trouvés étaient **tous
invisibles dans le code** — aucun `grep` de la phase 17 ne pouvait les voir.

Aucune migration n'a été nécessaire.

---

## D'abord : la suite de tests tourne enfin en entier

Depuis le début de cette campagne, chaque rapport se terminait par « les tests
qui demandent PostgreSQL n'ont pas pu tourner ». Ils tournent.

| | avant | après |
|---|---|---|
| fichiers | 19 passés, 9 en échec | **28 passés** |
| tests | 177 passés, **120 sautés** | **299 passés**, 0 sauté |

Les 120 tests sautés couvraient ce qui compte le plus : isolation entre
commerces, permissions, cycle de vie des commandes, ventes, achats, caisse.

### Et ils ont trouvé quelque chose

Un test échouait : la réception d'une commande fournisseur n'incrémentait pas
`Supplier.debtBalance`.

**Ce n'était pas un défaut du produit, mais un test périmé.** La phase 10 avait
délibérément abandonné ce compteur — un compteur qui résume des faits écrits
ailleurs finit par s'en écarter — au profit d'un calcul dérivé des livraisons
et des règlements. Le test vérifiait encore l'ancien monde.

Il vérifie désormais la valeur qui gouverne réellement le produit : `due`,
`paid`, `remaining` et l'état de règlement. Personne ne pouvait le savoir tant
que la suite ne tournait pas.

**Constat au passage :** `Supplier.debtBalance` existe toujours en base, à zéro,
et **aucun écran ne l'écrit ni ne le lit**. Une colonne morte qui affiche zéro
est trompeuse pour quiconque interroge la base directement. La supprimer est
une migration destructrice : je ne l'ai pas écrite de ma propre initiative.
Dites-le si vous la voulez.

---

## Comment les écrans ont été mesurés

`scripts/audit-responsive.mjs`, ajouté par cette phase, charge chaque page à
320, 375, 414 et 768 px et répond à deux questions :

1. **la page déborde-t-elle horizontalement**, et par la faute de quel élément
   précis — en ignorant ce qui déborde à l'intérieur d'un conteneur prévu pour
   défiler, qui est le comportement voulu ;
2. **reste-t-il des cibles tactiles sous 24 px**, en appliquant les deux
   exceptions du critère WCAG 2.5.8 : les liens en ligne dans une phrase, et
   les cibles assez espacées pour qu'un disque de 24 px n'en touche pas deux.

Sans ces exceptions, la sonde signalait une trentaine de liens de navigation
parfaitement utilisables et noyait le vrai signal. Le premier jet le faisait.

**Couverture : 276 combinaisons page × largeur**, sur les pages marketing et
d'authentification, les vitrines publiques, les **sept** modèles de site, les
20 écrans du tableau de bord Restaurant, les 12 de Boutique et les 12 du Super
Admin.

---

## Les cinq défauts

Trois viennent du **même piège de flexbox** : la largeur plancher d'un élément
`flex-1` est celle de son contenu tant qu'on ne pose pas `min-w-0`. L'élément
refuse alors de se comprimer et pousse la page. Rien ne le laisse deviner à la
lecture — c'est l'absence d'une classe qui fait le défaut, pas sa présence.

| écran | mesure | cause |
|---|---|---|
| Carte du restaurant | déborde de **24 px** à 320 | groupe de boutons `shrink-0` de 311 px, texte voisin comprimé à zéro |
| Vue d'ensemble Super Admin | déborde de **217 px** à 320 | 12 colonnes de graphique, plancher = largeur du libellé « avr. 26 » |
| Utilisateurs (Super Admin) | déborde de **15 px** à 320 | champ de recherche `flex-1`, plancher = largeur du texte indicatif |
| Carte du restaurant | cibles **18 × 24 px** | boutons ✎ et ✕ des catégories, jointifs |
| Atelier photo | cible **146 × 20 px** | seul moyen d'ajouter une photo sur téléphone |

Les deux graphiques partagés du Super Admin portaient le même défaut que la vue
d'ensemble ; ils sont corrigés aussi, avant qu'il ne se manifeste ailleurs.

### Celui qui compte le plus

L'atelier photo affichait « Glissez-déposez vos photos ici », puis, en petit au
milieu d'une phrase, un lien de 20 px « choisissez des fichiers ».

**Le glisser-déposer n'existe pas sur un téléphone.** Ce lien minuscule était
donc le seul moyen, pour un restaurateur sur son mobile, d'ajouter la moindre
photo — sur l'écran justement conçu pour en importer beaucoup d'un coup.

C'est devenu un vrai bouton, et sur petit écran c'est l'invitation au
glisser-déposer qui passe au second plan, puisqu'elle n'y sert à rien.

### Ce qui n'a rien donné

Les vitrines publiques et les **sept** modèles de site : aucun débordement,
aucune cible trop petite, à aucune des quatre largeurs. Le tableau de bord
Boutique non plus, sur ses douze écrans. C'est un bon résultat, et il est
maintenant mesuré plutôt que supposé.

Un signalement sur le modèle « elegant » n'a pas été reproduit : trois passes
ultérieures sont revenues propres. Je le note sans prétendre l'avoir corrigé —
il reste possible qu'il dépende d'un contenu ou d'un état que je n'ai pas su
recréer.

---

## Une erreur de méthode, et ce qu'elle a invalidé

À mi-parcours, j'ai reconstruit l'application sans réussir à arrêter le serveur
qui tournait : mon `pkill` visait `next start`, or le processus s'appelle
`next-server`.

Le serveur survivant a continué à servir un HTML pointant vers une feuille de
style que la reconstruction avait effacée. Elle répondait **400**, et les pages
se mesuraient donc **sans aucun style**.

Conséquences, que je préfère énoncer que taire :

- ma « vérification » que le correctif de la carte fonctionnait ne prouvait
  rien : elle portait sur une page sans style, où le groupe de boutons de
  311 px n'existait pas ;
- deux écrans signalés à ce moment-là — Apparence et Paramètres — étaient de
  **faux positifs** : leurs boutons mesuraient 21 px parce que Tailwind ne
  s'appliquait pas. Un bouton avec `p-4` ne peut pas faire 21 px de haut ; c'est
  ce chiffre absurde qui m'a fait vérifier au lieu de le rapporter.

J'ai failli vous annoncer une panne critique de feuille de style en production.
Elle n'existait que dans mon propre bac à sable.

**Toutes les mesures ont été refaites** après un redémarrage propre, en
vérifiant à chaque fois que la feuille de style servie est bien celle présente
sur le disque. Les chiffres de ce document viennent tous de cet état vérifié.
Le script porte désormais cet avertissement en tête.

**Un second défaut de méthode, corrigé :** quand la connexion échouait, la
sonde affichait quand même « ✓ aucun débordement sur 11 pages × 4 largeurs »,
alors qu'elle n'avait rien mesuré. Elle compte maintenant les combinaisons
réellement mesurées et signale les autres. Une sonde qui annonce un succès pour
ce qu'elle n'a pas regardé est pire qu'aucune sonde.

---

## Audit de sécurité de la phase

**Aucune logique métier n'est touchée.** Les cinq correctifs sont des classes
de mise en page. Aucune requête, aucune permission, aucune route.

**Le test corrigé ne relâche rien.** Il vérifie davantage qu'avant — quatre
valeurs dérivées au lieu d'un compteur — sur le même scénario.

**Les données de démonstration sont restées locales.** Base éphémère du
conteneur, jamais versionnée. Le rôle Super Admin accordé à un compte de
démonstration pour mesurer ces écrans l'a été dans cette base uniquement ; rien
de tel n'est écrit dans le dépôt.

**Le script d'audit n'entre pas dans le produit livré.** `playwright-core` est
installé sans être enregistré (`--no-save`) : `package.json` est inchangé, donc
aucune dépendance nouvelle ne part en production.

---

## Ce que cette phase n'a pas couvert

**Le sens de lecture en arabe.** Toujours pas regardé à l'œil, troisième phase
consécutive. La sonde mesure des largeurs, pas une direction de lecture. Il
faudrait charger chaque modèle en `dir="rtl"` et comparer visuellement.

**Les états intermédiaires.** Les pages ont été mesurées au repos. Un menu
ouvert, un tiroir déployé, une liste filtrée, un formulaire en erreur peuvent
déborder sans que ces mesures le disent.

**Le contenu extrême.** Les données de démonstration sont raisonnables. Un plat
au nom de 120 caractères ou un restaurant à 40 catégories n'a pas été essayé.

**Les vrais appareils.** Chromium redimensionné n'est pas un téléphone : ni le
clavier virtuel, ni la barre d'URL rétractable, ni Safari iOS, dont le moteur
diffère.

**Le test humain.** Ouvrez la carte du restaurant et l'atelier photo sur votre
téléphone. Sur la carte, les boutons ✎ et ✕ des catégories doivent être
confortables à toucher. Dans l'atelier, « Choisir des photos » doit être un
vrai bouton, immédiatement visible.
