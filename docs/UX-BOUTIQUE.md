# UX Boutique — phase 5

Trois défauts, dont deux qui touchent aussi le Restaurant.

---

## 1. Presque aucune action ne disait qu'elle avait réussi

Le produit contient un système de messages de confirmation — `ToastProvider`,
`useToast` — écrit, complet, et **appelé par personne**. Le fournisseur était
monté sur le tableau de bord Restaurant ; aucun écran, d'aucun côté, ne
demandait jamais l'affichage d'un message.

Six écrans s'étaient fabriqué leur propre confirmation, chacun de son côté et
sous une forme différente : les deux parcours d'abonnement, les réglages
Restaurant, le panneau de démonstration de l'administration, et deux
formulaires d'authentification. Six sur l'ensemble du produit.

Partout ailleurs, contrairement au §30 : enregistrer un paiement client,
supprimer une dépense, réceptionner une commande fournisseur ne produisait
aucun mot. Le formulaire se refermait, et c'était tout. Le commerçant devait
déduire du retour au silence que ça s'était bien passé.

`useServerMutation` porte désormais deux options, `successMessage` et
`settled(message, fermeture)`. Le fournisseur est monté côté Boutique — dans le
`DashboardShell` plutôt que dans le layout, ce dernier ayant trois sorties
distinctes (visite guidée, mur d'abonnement, tableau de bord) qu'il aurait
fallu envelopper séparément.

Vingt-six actions confirment maintenant ce qu'elles ont fait. La règle appliquée :
**on ne confirme que ce qui ne se voit pas**. Un badge qui change de couleur
sous les yeux se passe de commentaire ; un paiement encaissé, un réglage
enregistré, une réception validée, non.

### Deux échecs qui étaient purement et simplement avalés

Supprimer une dépense et supprimer un code promo s'écrivaient sans `catch` :

```ts
try { await api.delete(...); router.refresh(); }
finally { setPending(false); }
```

En cas de refus du serveur, rien. Pas de message, pas de trace, la ligne reste
en place. Le commerçant conclut qu'il a mal appuyé et recommence.

---

## 2. Le menu ne disait pas où il menait

Chaque page portait une description parfaitement claire, écrite pour un
commerçant. Le menu n'en gardait qu'un mot, souvent le plus obscur.

| Page | Ce qu'elle dit d'elle-même | Ce que le menu disait |
|---|---|---|
| Prévisions | « Ce qui risque de manquer, et quand » | **Prévisions** |
| Lots | « Stock suivi par date de péremption » | **Lots** |
| Mouvements de stock | « Chaque entrée et chaque sortie » | **Mouvements** |

Le cas le plus coûteux était celui des **quatre écrans de chiffres**. Dans le
langage courant, « Statistiques », « Analyses », « Finances » et « Rapports »
veulent dire la même chose. Ils portent pourtant quatre contenus bien
distincts, qu'aucun commerçant ne pouvait deviner sans ouvrir les quatre :

| Avant | Après | Contenu réel |
|---|---|---|
| Statistiques | **Chiffres de vente** | chiffre d'affaires, panier moyen, produits les plus vendus |
| Analyses | **Marges et stock** | valeur du stock, capital immobilisé, vendu à perte, dormants |
| Finances | **Bénéfices** | recettes, coût des marchandises, dépenses, pertes, trésorerie |
| Rapports | **Rapports à imprimer** | documents filtrables, imprimables et exportables |

Les titres des pages ont été renommés à l'identique : un menu qui annonce
« Marges et stock » et débouche sur une page titrée « Analyses » serait pire
que les deux noms pris séparément.

**Les adresses ne changent pas.** Un lien mis en favori continue de
fonctionner, et les icônes, indexées par adresse, suivent d'elles-mêmes.

### Regroupement

Les sections séparent maintenant le travail des chiffres :

- **Au quotidien** — vue d'ensemble, caisse, ventes, notifications ;
- **Ma boutique** — produits, entrées et sorties, ruptures à venir, dates de
  péremption, achats fournisseurs, clients ;
- **Mon argent** — bénéfices, dépenses, promotions ;
- **Mes chiffres** — chiffres de vente, marges et stock, rapports ;
- **Mon compte** — équipe, abonnement, réglages, sécurité, aide.

Les quatre écrans d'analyse étaient mêlés à la caisse et aux ventes, ce qui
faisait de la première section la plus longue du menu — huit entrées, dont trois
seulement servent en permanence.

Une section s'appelait « Finances » et contenait une page appelée « Finances ».

---

## 3. Une consigne sans le chemin pour l'appliquer

L'écran des marges affichait, quand aucun coût d'achat n'était renseigné :

> Aucune marge calculable : renseignez le coût d'achat de vos produits.

Sans dire où. Le commerçant devait chercher dans le menu l'écran qui permet
d'agir. La phrase explique désormais ce qu'est un coût d'achat — « le prix
auquel vous, vous les achetez » — et un bouton mène directement au catalogue.

---

## Audit de sécurité de la phase

Vérifié, aucune faille introduite.

**Les messages de confirmation ne contiennent aucune donnée.** Ce sont des
phrases fixes écrites dans le code. Les messages d'échec reprennent la réponse
du serveur, dont tous les chemins avaient déjà été relus en phase 4 : erreur
applicative rédigée pour un commerçant, phrase fixe, ou 500 générique. React
échappe le texte affiché dans les deux cas.

**Les renommages ne touchent ni les adresses, ni les droits.** Seuls des
intitulés et des titres de page changent. Les deux entrées de menu
conditionnelles gardent leur condition — « Toutes les boutiques » reste réservée
aux comptes multi-boutiques, « Sécurité » reste masquée en visite guidée.

**Le fournisseur de messages est correctement porté.** Les dix écrans qui
utilisent `useServerMutation` ont été vérifiés un par un : tous rendent sous un
`ToastProvider`. Le mur d'abonnement, seule branche sans fournisseur, n'utilise
pas le module.

> **Rectification apportée en phase 6.** Ce paragraphe affirmait que les écrans
> Dépenses et Promotions « servent aux deux produits et sont couverts des deux
> côtés ». C'était faux : il existe **deux implémentations distinctes portant le
> même nom**, `components/boutique/expenses-manager` et
> `components/dashboard/expenses-manager`, de même pour les promotions. La
> phase 5 n'avait donc corrigé que les versions Boutique. Les versions
> Restaurant ont été converties en phase 6. Leur gestion d'erreur, elle, était
> correcte — le `catch` manquant ne concernait bien que les copies Boutique.

**Les échecs désormais affichés n'en révèlent pas plus.** Ils passent par la
même enveloppe que partout ailleurs ; ce qui change, c'est qu'ils cessent
d'être silencieux.

---

## Ce que cette phase n'a pas couvert

**Le formulaire d'ajout de produit** — unités, déclinaisons, coût d'achat. Le
§9 en fait son exemple de langage à corriger, mais c'est l'objet des phases 10
et 11 ; le traiter ici aurait dédoublé le travail.

**Les écrans de réglages** — secteur, taxes, moyens de paiement — utilisent
encore l'ancien enchaînement, sans confirmation. Ils sont ouverts une fois à
l'installation.

**Le test humain.** Rien ici ne remplace l'ouverture des écrans : les
renommages se jugent en les lisant, pas en les relisant dans un diff.
