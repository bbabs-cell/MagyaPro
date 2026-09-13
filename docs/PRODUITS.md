# Ajout d'un produit, unités, déclinaisons — phase 11

Trois sections du prompt (§10, §11, §12) et une conclusion inattendue : **le
plus gros du travail était déjà fait**, et bien fait. Ce qui manquait tenait
presque entièrement au vocabulaire et à la quantité de choses montrées d'un
coup.

---

## Ce qui existait déjà

Avant de proposer quoi que ce soit, j'ai vérifié :

- **§10, filtrage des unités par secteur.** Fait. `SECTOR_UNITS` associe à
  chaque métier ses unités, et une boutique reçoit les siennes à sa création.
  Un épicier ne voit pas « m² », un quincaillier ne voit pas « bouteille ».
- **§10, « autre unité » pour les cas particuliers.** Possible : les unités
  d'une boutique lui appartiennent et se créent, se renomment et se
  désactivent depuis ses réglages.
- **§11, exemples propres au métier.** Fait. `SECTOR_VARIANT_AXES` propose
  « taille et couleur » à un habilleur, autre chose ailleurs, en un bouton.
- **§11, aperçu des versions créées.** Le tableau existait.
- **§12, réactivité.** Fait en phase 5 : confirmation, liste dégelée, aucun
  rafraîchissement manuel.

Rien de tout cela n'était à refaire. Le reste de ce document porte sur ce qui
manquait vraiment.

---

## 1. Le vocabulaire était celui du logiciel, pas celui du commerçant

Le §11 demande d'éviter le jargon technique. La section s'appelait
**« Déclinaisons (facultatif) »** et demandait :

| Avant | Après |
|---|---|
| Déclinaisons (facultatif) | **Ce produit existe en plusieurs versions ?** |
| Nom de l'axe | **Qu'est-ce qui change ?** |
| Valeurs, séparées par une virgule | **Les possibilités, séparées par une virgule** |
| + Ajouter un axe | **+ Autre chose qui change** |
| Générer les combinaisons | *(supprimé — voir plus bas)* |
| Utiliser taille et couleur | **Mon produit varie par taille et couleur** |
| colonne « Déclinaison » | colonne **« Version »** |

« Axe » et « valeurs » sont des mots de développeur. « Déclinaison » est un mot
de catalogue. Aucun des trois n'aide quelqu'un qui vend des tee-shirts.

L'explication de la section dit maintenant ce qu'est une version, avec les deux
exemples que le §11 réclame :

> Une version, c'est le même produit décliné : le même tee-shirt en rouge et en
> bleu, la même huile en 1 L et en 5 L. Chaque version a son propre stock et
> peut avoir son propre prix.

---

## 2. L'aperçu attendait un clic

Le §11 demande « un aperçu des variantes créées ». Il existait — mais derrière
un bouton **« Générer les combinaisons »**, dont le nom n'apprenait à personne
ce qu'il ferait, et qui ne produisait rien tant qu'on n'y pensait pas.

Un aperçu qui attend un clic n'est pas un aperçu. Les versions se dressent
maintenant seules, dès qu'un critère est complet, et le bouton a disparu.

Le travail déjà saisi est conservé — prix, référence, stock — et seules les
versions manquantes s'ajoutent : ajouter une taille n'efface pas les prix des
couleurs déjà remplies. Le recalcul est déclenché par la **signature du
contenu** des critères, et non par l'identité des objets, sans quoi un simple
rendu relancerait le calcul en boucle.

---

## 3. Quatre sections facultatives, toutes dépliées

C'est le « trop d'options » du §10, littéralement.

Le formulaire demandait cinq choses essentielles — nom, catégorie, marque,
coût, prix — puis déroulait **quatre encadrés « (facultatif) »** ouverts en
permanence : versions, conditionnements, réapprovisionnement, attributs. Un
commerçant qui voulait enregistrer un savon à 500 F devait les traverser tous
pour trouver le bouton d'enregistrement.

Les trois derniers sont désormais repliés, et chacun pose une question plutôt
que de nommer un concept :

- **Vendez-vous aussi par carton, sac ou paquet ?**
- **Voulez-vous être prévenu avant la rupture ?**
- **Préciser matière ou origine ?** *(les deux mots viennent du secteur)*

Rien n'est retiré : ce qui servait sert toujours, mais se demande. Et une
section **s'ouvre d'elle-même quand elle contient déjà quelque chose** — sans
quoi une modification cacherait des données que le produit possède.

---

## 4. Deux impasses

**Le formulaire ne disait pas où trouver une unité manquante.** Quand la
boutique n'avait pas d'autre unité à proposer, il affichait « Aucune autre
unité disponible dans cette boutique » — un constat, sans la sortie. Le §10
demande de prévoir discrètement « autre unité » ; c'était possible, mais depuis
les réglages, et rien ne le disait. La phrase mène maintenant à l'écran qui
permet d'en créer une.

**Une référence périmée que j'avais créée moi-même.** La section
réapprovisionnement renvoyait à « l'écran **Prévisions** » — un écran que
j'avais renommé « Ruptures à venir » en phase 5 sans reprendre ce renvoi. J'ai
cherché les autres : il n'y en avait qu'un visible par un commerçant, plus deux
commentaires de code, corrigés aussi.

---

## 5. Le formulaire produit rejoint la règle commune

Il gardait son propre enchaînement d'attente : le bouton cessait de tourner
avant que la liste ne soit à jour. Il passe par `useServerMutation`, comme les
vingt autres écrans, et récupère au passage l'affichage des erreurs par champ.

---

## Audit de sécurité de la phase

**Aucune règle de validation n'a changé.** Replier une section ne retire ni un
champ, ni un contrôle : les mêmes données partent au serveur, qui les valide
comme avant. Une section repliée envoie exactement ce qu'elle envoyait
dépliée — ses champs restent montés dans le formulaire.

**Le calcul automatique des versions ne crée rien tout seul.** Il ne fait que
dresser une liste à l'écran ; rien n'est enregistré tant que le formulaire
n'est pas soumis, et le serveur recalcule les combinaisons de son côté.

**Le lien ajouté mène à un écran du même commerce**, protégé par ses
permissions habituelles — un employé sans droit sur les réglages y sera refusé
comme avant.

**Les renommages ne touchent que des libellés.** Aucun nom de champ envoyé au
serveur ne change ; `attr1`, `attr2`, `supplierLeadDays` et les autres gardent
leurs noms.

---

## Ce que cette phase n'a pas couvert

**Le petit formulaire d'ajout rapide** (catégorie, marque) garde l'ancien
enchaînement. Il a deux champs et un bouton ; le convertir n'apporterait rien
de visible.

**Le test humain.** Ce qui se juge à l'usage : ouvrir « Nouveau produit » et
regarder combien de choses sont demandées avant le bouton d'enregistrement,
puis cocher deux critères de variation et voir les versions apparaître sans
rien cliquer d'autre.
