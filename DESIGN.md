---
name: MagyaPro
description: Outil de gestion pour commerçants d'Afrique de l'Ouest — caisse, stock et commandes, sur un téléphone.
colors:
  braise: "#ff5e2e"
  braise-soft: "#fff1e6"
  braise-ink: "#ffffff"
  surface: "#fbf8f2"
  surface-raised: "#ffffff"
  surface-sunken: "#ece5d8"
  surface-border: "#ddd3c1"
  ink: "#211d16"
  ink-muted: "#6a6153"
  ink-faint: "#948b7b"
  nav: "#2a2118"
  nav-raised: "#35291d"
  nav-ink: "#f5efe3"
  nav-muted: "#b3a894"
  navy: "#0b1730"
  state-ok: "#2f6b4a"
  state-ok-soft: "#dcece2"
  state-warn: "#a8700f"
  state-warn-soft: "#f9edd6"
  state-bad: "#a8322f"
  state-bad-soft: "#f8e0de"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
  micro:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
  receipt:
    fontFamily: "DM Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  button: "0.875rem"
  card: "1.25rem"
  card-marketing: "1.5rem"
  pill: "9999px"
spacing:
  cell: "0.375rem"
  tight: "0.75rem"
  card-padding: "1rem"
  section: "1.5rem"
  block: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.braise}"
    textColor: "{colors.braise-ink}"
    rounded: "{rounded.button}"
    padding: "0 1rem"
    height: "2.75rem"
    typography: "{typography.title}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 1rem"
    height: "2.75rem"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.button}"
    padding: "0 1rem"
    height: "2.75rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0.625rem 0.875rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  badge-success:
    backgroundColor: "{colors.state-ok-soft}"
    textColor: "{colors.state-ok}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  badge-danger:
    backgroundColor: "{colors.state-bad-soft}"
    textColor: "{colors.state-bad}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  nav-item-active:
    backgroundColor: "{colors.braise}"
    textColor: "{colors.braise-ink}"
    rounded: "{rounded.button}"
    padding: "0.375rem 0.75rem"
---

# Design System: MagyaPro

## Overview

**Creative North Star: "La Braise"**

Une braise ne fait pas de flamme. Elle est sombre, chaude au toucher, et elle
tient toute la nuit. C'est le registre de MagyaPro : une navigation brun
torréfié qui ne bouge pas, des surfaces sable et crème qui portent le travail,
et un seul orange vif — rare, jamais décoratif — qui dit où appuyer.

Le produit tient la caisse d'un commerce. Il est consulté debout, entre deux
clients, sur un téléphone dont l'écran prend le soleil. La densité sert la
lecture, pas la démonstration : un chiffre par question, une action évidente
par écran, et rien qui bouge sans raison. La chaleur n'est pas un ornement
ajouté après coup, c'est ce qui distingue cet outil du tableur qu'il remplace.

Ce que ce système refuse explicitement : **le logiciel comptable austère** —
gris, froid, dense, conçu pour des experts. Les utilisateurs de MagyaPro ne
sont pas comptables et ne doivent pas se sentir jugés par leur écran. Un
commerçant qui ouvre l'application doit reconnaître son commerce, pas subir un
formulaire.

**Key Characteristics:**

- Navigation sombre et stable, contenu clair et changeant.
- Un seul accent orange, réservé à l'action principale.
- Cartes légèrement surélevées au repos, comme des fiches posées sur le comptoir.
- Couleurs d'état séparées de la couleur de marque : un stock en rupture n'est
  jamais « de la couleur de MagyaPro ».
- Chiffres alignés en colonnes, toujours.

## Colors

Une palette de terre chaude — sable, crème, brun torréfié — traversée par une
seule braise orange.

### Primary

- **Braise** (`#ff5e2e`) : l'action principale d'un écran, et l'entrée de menu
  active. Rien d'autre. Sur les sites publics des restaurants, cette valeur est
  remplacée par la couleur du restaurant lui-même : la variable `--brand` est
  pilotée par le tenant, et c'est voulu — l'identité affichée au client final
  est celle du commerce, pas celle de MagyaPro.
- **Braise pâle** (`#fff1e6`) : fond des pastilles de marque et des zones
  d'appel discrètes.

### Secondary

- **Brun torréfié** (`#2a2118`) : la navigation. Il reste sombre dans les deux
  thèmes, clair comme sombre — c'est le repère fixe pendant que le contenu, lui,
  s'éclaircit ou s'assombrit.
- **Brun relevé** (`#35291d`) : élément de navigation survolé, et fond des
  regroupements à l'intérieur de la barre.
- **Bleu nuit** (`#0b1730`) : réservé à l'administration de la plateforme et au
  héros du site marketing. Ce n'est pas une couleur produit ; elle ne doit
  jamais apparaître dans un tableau de bord commerçant.

### Neutral

- **Sable** (`#fbf8f2`) : le fond de travail. Jamais du blanc pur — un ivoire
  doux, moins fatigant sous forte luminosité.
- **Papier** (`#ffffff`) : surface légèrement au-dessus du sable — en-tête de
  tableau, ligne survolée, carte posée sur un fond creusé.
- **Sable creusé** (`#ece5d8`) : fond en retrait, derrière les cartes.
- **Filet** (`#ddd3c1`) : bordures et séparateurs.
- **Encre** (`#211d16`) : le texte. Un brun très sombre, jamais un noir neutre.
- **Encre atténuée** (`#6a6153`) : texte secondaire, intitulés de champs.
- **Encre pâle** (`#948b7b`) : indices, texte d'invite, intitulés de cellules
  sur mobile.

### Named Rules

**La règle de l'orange unique.** Un seul élément orange par écran : l'action
principale. Un deuxième bouton orange n'attire pas deux fois plus l'attention,
il annule le premier.

**La règle de l'état neutre.** Les couleurs d'état — vert, ambre, rouge — sont
définies séparément de la marque et ne s'en approchent jamais. Elles disent un
fait vérifiable (stock sain, seuil franchi, rupture), jamais une identité. Un
écran où tout est coloré est un écran où plus rien n'est signalé.

**La règle du fond qui ne blanchit pas.** Aucune surface de travail en
`#ffffff` pur, sauf une carte posée au-dessus du sable. Le blanc pur est
réservé au reçu imprimable, qui repasse volontairement en blanc à l'impression.

## Typography

**Display Font:** Bricolage Grotesque (auto-hébergée, variable, repli sur la pile système)
**Body Font:** la pile système — `ui-sans-serif`, `system-ui`, puis les polices natives
**Receipt/Mono Font:** DM Mono, pour le ticket de caisse, le bon de cuisine, les identifiants et les codes

**Character:** le corps de texte est délibérément **la police de l'appareil**.
Un outil consulté toute la journée se lit mieux dans le caractère que le
téléphone dessine le mieux, et rien n'est téléchargé pour lui — un choix qui
compte sur des connexions irrégulières. Bricolage Grotesque, grotesque à axe
optique variable, n'intervient qu'aux titres : ses formes se resserrent en
grand et s'ouvrent en petit, elle a du caractère sans être décorative. DM Mono
est la police du papier, pas du terminal : plus chaude qu'une police d'éditeur
de code, elle convient aux deux seuls objets que ce produit imprime vraiment.

Le contraste entre un titre dessiné et un corps de texte natif est le seul
geste typographique du système. Il n'en faut pas d'autre.

### Hierarchy

- **Display** (Bricolage Grotesque 600, 1.25rem montant à 2.25rem) : le titre
  de page, et lui seul dans les tableaux de bord. Sur les pages publiques, elle
  porte aussi les titres de section et les grands nombres.
- **Headline** (système 600, 1.5rem) : titre de section à l'intérieur d'une page.
- **Title** (système 500, 0.875rem) : intitulé de carte, en-tête de tableau,
  entrée de navigation.
- **Body** (système 400, 0.9375rem, interligne 1.6) : le texte courant. Les
  paragraphes explicatifs ne dépassent pas 70 caractères par ligne.
- **Label** (système 500, 0.75rem, interlettrage 0.05em, en capitales) :
  intitulés de statistiques et de cellules sur mobile.
- **Micro** (système 500, 0.6875rem) : le dernier degré avant l'illisible.
  Réservé à deux emplois sur grand écran — les étiquettes d'axe d'un graphique
  et les intertitres de la barre latérale. Jamais sur un écran tactile, jamais
  pour une information qu'on ne peut pas retrouver ailleurs.
- **Receipt** (DM Mono 400, 0.75rem) : ticket de caisse, bon de cuisine,
  identifiants techniques et codes.

### Named Rules

**La règle des chiffres alignés.** Tout nombre lu en colonne — tableau, liste,
total — porte `tabular-nums`. Un total qui ne s'aligne pas avec celui du dessus
se compare à l'œil, donc mal.

**La règle du corps natif.** Le texte courant reste sur la pile système et
aucune police n'est chargée pour lui. Déclarer une famille qu'on ne télécharge
pas revient à décrire une typographie qui n'existe pas : c'était le cas ici
pendant longtemps, « Inter » figurant en tête de la pile sans jamais être
servie. Une famille nommée dans ce fichier est une famille réellement chargée.

**La règle de l'arabe.** Bricolage Grotesque ne couvre pas l'arabe. En lecture
inversée, les titres reprennent la pile système : mieux vaut une hiérarchie
plus plate qu'un caractère de substitution imposé par le navigateur.

**La règle du repli sans serif.** `--font-display` retombe sur la pile sans
empattement, jamais sur une serif générique : les sites publics des restaurants
remplacent cette variable par leur propre police, et un repli serif y
produirait un mélange involontaire le temps du chargement.

## Layout

Deux colonnes sur ordinateur : une barre latérale fixe de 16rem, un contenu
fluide plafonné à 64rem sur les tableaux de bord et 80rem sur l'administration.
La barre est `sticky` sur toute la hauteur de la fenêtre et défile d'un bloc si
elle dépasse — jamais un cadre intérieur qui trancherait ses intertitres.

Sous 1024px, la barre latérale devient un tiroir : par-dessus le contenu avec
un fond assombri côté Boutique, déroulant sous l'en-tête côté administration.
Dans les deux cas, la hauteur est bornée puis défilante — une entrée de menu
hors d'atteinte sous le bas de l'écran est un défaut, pas un détail.

Sous 768px, **tout tableau devient une liste de fiches** : les en-têtes
disparaissent et chaque cellule reprend son intitulé. C'est la bascule la plus
structurante du système ; elle s'applique à tous les journaux — ventes,
mouvements, achats, abonnements.

Rythme vertical : 1rem à l'intérieur d'une carte, 1,5rem entre deux blocs d'une
même section, 2,5rem entre deux sections. Les grilles de statistiques passent
de quatre colonnes à deux, puis à une.

### Named Rules

**La règle de l'intitulé porté.** Une cellule de tableau sans `data-label`
devient une valeur nue sur mobile — un nombre sans nom. Toute cellule en porte
un, ou déclare explicitement qu'elle n'en veut pas.

## Elevation & Depth

Le système est **légèrement surélevé au repos** : une carte flotte doucement,
comme une fiche posée sur un comptoir, et se soulève davantage si elle est
cliquable. La profondeur vient d'un empilement — fond creusé, carte, filet —
autant que de l'ombre elle-même.

Chaque ombre a deux couches : un contact net et proche, une diffusion large et
douce. Une couche unique donne un rendu plat et « collé ».

### Shadow Vocabulary

- **Élévation 1** (`0 1px 2px rgba(33,29,22,.06), 0 6px 16px -10px rgba(33,29,22,.18)`) :
  l'état de repos de toute carte.
- **Élévation 2** (`0 2px 4px rgba(33,29,22,.07), 0 16px 32px -18px rgba(33,29,22,.26)`) :
  survol d'une carte cliquable, et surfaces flottantes.

### Named Rules

**La règle de l'ombre chaude.** Les ombres sont teintées d'encre brune
(`rgba(33,29,22,…)`), jamais de noir pur. Une ombre noire sur un fond sable
grise la couleur au lieu de la poser.

**La règle du soulèvement discret.** Une carte cliquable se soulève de 2px au
survol. Assez pour être perçu, jamais assez pour faire sauter la grille sous le
curseur.

## Shapes

Des angles franchement adoucis, sans jamais devenir des pastilles. Les rayons
suivent la taille de l'objet : 0,875rem pour un bouton ou un champ, 1,25rem
pour une carte de tableau de bord, 1,5rem pour une carte du site marketing —
plus généreux là où il y a plus d'air.

Les pastilles d'état sont les seules formes entièrement arrondies. Ce contraste
est délibéré : une pastille n'est pas un bouton, et sa forme doit le dire avant
qu'on ait lu son texte.

Les bordures sont des filets d'un pixel en sable foncé. Une carte se détache
par la combinaison filet + fond + ombre, jamais par un trait épais.

Une forme de signature : **le rail d'état**, une barre de 3px collée au bord
gauche d'une carte ou d'une ligne, colorée selon l'état du stock. L'information
se lit à la couleur avant même d'être lue au texte.

## Components

### Buttons

- **Shape:** angles adoucis (0,875rem), hauteur fixe par taille — 2,25rem,
  2,75rem, 3rem.
- **Primary:** fond braise, texte blanc, ombre portée teintée de braise à 30 %.
  Au survol, la luminosité monte de 10 % plutôt qu'un changement de teinte : la
  couleur reste la même, elle s'active.
- **Hover / Focus:** transition de 150ms sur la couleur, la transformation et
  l'ombre. À l'appui, le bouton se comprime à 98 % — une réponse tactile, pour
  un produit utilisé au doigt.
- **Secondary:** fond sable, filet, texte encre. Au survol, le fond se creuse.
- **Ghost:** texte atténué seul, fond au survol uniquement. Pour les actions de
  service — « Tout afficher », « Annuler ».
- **Danger:** rouge franc, réservé à la destruction irréversible.

### Chips

- **Style:** entièrement arrondies, fond pâle de l'état, texte dans la teinte
  pleine du même état. Jamais de bordure.
- **State:** six tons — neutre, succès, avertissement, danger, information,
  marque. Le ton dit un fait ; il ne décore pas.

### Cards / Containers

- **Corner Style:** 1,25rem sur les tableaux de bord, 1,5rem sur le marketing.
- **Background:** sable, posé sur un fond creusé.
- **Shadow Strategy:** élévation 1 au repos, élévation 2 au survol si la carte
  est cliquable. Voir Elevation & Depth.
- **Border:** filet d'un pixel. Sur une carte interactive survolée, le filet
  s'assombrit jusqu'à l'encre pâle.
- **Internal Padding:** 1rem, porté à 1,25rem au-delà de 640px.

### Inputs / Fields

- **Style:** filet d'un pixel, fond sable, angles à 0,875rem, texte à 15px —
  au-dessus du seuil qui déclenche le zoom automatique sur iOS.
- **Focus:** la bordure passe à l'encre et un anneau d'un pixel s'ajoute. Pas
  de halo coloré : le champ actif se distingue par le contraste, pas par une
  couleur de plus.
- **Disabled:** fond creusé, texte pâle, curseur barré.

### Navigation

- **Style:** fond brun torréfié constant, entrées en 0,875rem, icône à gauche,
  libellé tronqué plutôt que replié.
- **Active:** dégradé braise, texte blanc — le seul endroit où l'accent apparaît
  hors bouton principal.
- **Hover:** fond légèrement relevé, texte qui remonte du muet au plein.
- **Mobile:** tiroir borné et défilant, fermé au choix d'une entrée.

### Le rail d'état

Barre de 3px au bord gauche d'une carte ou d'une ligne, pilotée par une seule
variable. Vert : stock sain. Ambre : seuil franchi. Rouge : rupture. Permet de
balayer une liste de vingt produits sans lire un seul mot.

## Do's and Don'ts

### Do:

- **Do** réserver la braise (`#ff5e2e`) à une seule action par écran, et à
  l'entrée de menu active.
- **Do** aligner tout nombre lu en colonne avec `tabular-nums`.
- **Do** donner un `data-label` à chaque cellule de tableau — sans lui, la
  valeur devient anonyme sous 768px.
- **Do** teinter les ombres d'encre brune, jamais de noir pur.
- **Do** garder la navigation sombre dans les deux thèmes : c'est le repère qui
  ne bouge pas.
- **Do** annoncer une échéance ou une variation en toutes lettres — « dans 3
  jours », « dépassée de 2 jours » — plutôt qu'une date à décompter de tête.

### Don't:

- **Don't** utiliser le bleu nuit (`#0b1730`) dans un tableau de bord
  commerçant : il appartient à l'administration de la plateforme.
- **Don't** colorer une carte avec la couleur de marque pour signaler un état.
  Les états ont leurs propres couleurs, délibérément séparées.
- **Don't** poser une surface de travail en blanc pur.
- **Don't** empiler une carte dans une carte. Un fond creusé et un filet
  suffisent à séparer deux niveaux.
- **Don't** enfermer la navigation dans un cadre à défilement propre : sur une
  fenêtre courte, il tranche les intertitres en pleine hauteur de lettre.
- **Don't** ajouter une animation qui ne répond pas à une action de
  l'utilisateur. La seule animation d'entrée du système est un fondu de 180ms.

### Une seule déclaration des neutres

Les rôles neutres ont porté deux valeurs selon le contexte — celles de la
configuration Tailwind et celles du thème Boutique, à deux ou trois points près
sur chaque canal. C'est résolu : ils sont déclarés une fois, sur `:root` dans
`globals.css`, donc pour tout le produit. Le thème sombre de Boutique est le
seul à les redéfinir, et les valeurs de repli de la configuration Tailwind sont
tenues identiques par principe — un repli qui diverge de la vraie valeur est une
seconde vérité en sommeil.

Les couleurs d'état, elles, divergent **volontairement** : Boutique adoucit
vert, ambre et rouge pour son fond sable, le reste du produit garde des tons
plus francs. Cette différence-là est un choix, pas une dérive.
