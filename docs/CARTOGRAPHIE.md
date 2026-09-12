# Cartographie MagyaPro — phase 2

Relevé du dépôt, **lecture seule**. Sert de carte pour les dix-neuf phases
suivantes : avant de modifier un écran, on sait ce qu'il touche.

---

## 1. Les quatre univers

| Univers | Écrans | Routes d'API | Qui y entre |
|---|---|---|---|
| Tableau de bord **Restaurant** | 26 | 68 | 4 rôles |
| Tableau de bord **Boutique** | 23 | 49 | 7 rôles |
| **Super Admin** | 17 | 28 | 1 rôle de plateforme |
| **Sites publics** des restaurants | 10 | 10 publiques | visiteurs, sans compte |

Marketing, authentification et reçus imprimables : 20 écrans de plus.

**76 modèles de données**, dont 29 propres à Boutique.

---

## 2. Restaurant — les 26 écrans

**Service** — vue d'ensemble, à traiter (alertes), notifications, commandes,
fiche d'une commande, cuisine, réservations, salle, livraison, mes livraisons.

**Carte et vente** — menu, promotions, fidélité, avis, clients, galerie, photos.

**Analyse** — statistiques, finances, journal.

**Réglages** — apparence, paramètres, équipe, abonnement, sécurité, aide.

### Rôles

| Rôle | Permissions |
|---|---|
| Propriétaire | les 29 |
| Administrateur | celles de l'employé, plus la gestion |
| Employé | 8 |
| **Livreur** | **1** — `deliveries:drive` |

Le livreur est le modèle d'un rôle bien cloisonné : une seule permission, un
seul écran. C'est exactement ce qu'il faudra reproduire pour la cuisine.

---

## 3. Boutique — les 23 écrans

**Vente** — vue d'ensemble, caisse, ventes, notifications.

**Analyse** — rapports, statistiques, analyses, toutes les boutiques.

**Stock et achats** — produits, prévisions, mouvements, achats, lots, clients.

**Argent** — finances, dépenses, promotions.

**Réglages** — équipe, abonnement, paramètres, sécurité, aide, nouvelle
boutique.

### Rôles

Propriétaire, administrateur, manager, caissier, vendeur, gestionnaire de
stock, comptable — **sept rôles pour 32 permissions**.

Boutique a donc un modèle de droits bien plus fin que Restaurant, qui n'en a
que quatre. Cette asymétrie explique le manque du §18 : côté Boutique, un
caissier ne voit que la caisse ; côté Restaurant, un cuisinier voit tout ce
qu'un employé voit.

---

## 4. Super Admin — les 17 écrans

Vue d'ensemble · consolidé · restaurants · fiche restaurant · boutiques ·
fiche boutique · utilisateurs · plans · abonnements · abonnements Boutique ·
analytics · analytics Boutique · journal · notifications · annonces ·
templates · images.

**Six écrans forment trois paires jumelles** — restaurants/boutiques,
abonnements/abonnements Boutique, analytics/analytics Boutique. C'est
précisément ce que les §23 à §27 demandent de réorganiser en deux univers de
premier niveau plutôt qu'en paires dispersées.

---

## 5. Ce que la carte fait apparaître

### F1. Le trou de la cuisine, mesuré

L'écran cuisine exige la permission `orders:update_status`. Un employé la
possède — mais il possède aussi sept autres permissions.

Un cuisinier à qui l'on donne le rôle « Employé » voit donc **le fichier
clients, les réservations, les tables et l'écran des livraisons**. Rien ne le
lui interdit.

Le correctif a déjà son modèle dans le produit : le rôle Livreur, une
permission, un écran. À reproduire en phase 9.

### F2. Quatre écrans pour la même famille de questions

Boutique propose Rapports, Statistiques, Analyses **et** Finances. Chacun a un
contenu distinct et utile — ce qui se vend, ce qui coûte, ce qu'on imprime, ce
qui reste. Mais leurs noms ne le disent pas : pour un commerçant, « statistiques »
et « analyses » sont deux mots pour la même chose.

À traiter dans la phase UX Boutique.

### F3. Deux langues dans les chemins d'API

Côté Boutique, l'import et l'export Excel vivent sous `produits`, la création
et la modification sous `products`. Les deux servent, aucun n'est mort. C'est
une incohérence de nommage, pas un défaut de fonctionnement.

### F4. Le déséquilibre des univers

Restaurant porte 68 routes d'API pour 26 écrans, Boutique 49 pour 23. Le
Super Admin en compte 28 pour 17 écrans. Rien d'anormal, mais cela situe
l'effort : la phase Super Admin touchera moins de surface qu'il n'y paraît.

---

## 6. Ce que cette carte ne dit pas

Elle recense ce qui existe, pas ce qui marche bien. La qualité écran par écran
relève des phases 5, 6 et suivantes, et surtout du test humain : cette session
n'a ni base de données ni navigateur.
