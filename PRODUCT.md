# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Deux usages simultanés, sur des appareils différents, à servir également :

- **Le propriétaire**, sur son téléphone. Il consulte plus qu'il ne saisit :
  ce qui est rentré, ce qui manque en stock, qui lui doit de l'argent. Souvent
  debout, entre deux tâches, hors de son commerce.
- **Un employé** — caissier, vendeur, gestionnaire de stock, comptable — sur un
  autre appareil, en saisie continue. Il change, il est formé vite, il ne doit
  pas pouvoir se tromper ni voir ce qui ne le regarde pas.

Ces deux personnes ne partagent ni le même écran, ni les mêmes droits, ni la
même urgence. Les rôles existent en base et sont appliqués côté serveur :
`OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `SALESPERSON`, `STOCK_MANAGER`,
`ACCOUNTANT` côté Boutique ; `OWNER`, `ADMIN`, `EMPLOYEE`, `COURIER` côté
Restaurant.

## Product Purpose

MagyaPro équipe des commerçants d'Afrique de l'Ouest francophone d'un outil de
gestion qui tient sur un téléphone.

Deux produits distincts, chacun avec ses propres tenants, plans et tableaux de
bord :

- **MagyaPro Restaurant** — site public du restaurant, menu, commandes en
  ligne, livraison, commandes à table par QR, statistiques.
- **MagyaPro Boutique** — caisse, stock et lots, achats et fournisseurs,
  clients et crédit, dépenses, prévisions, statistiques.

Le succès se mesure à une chose : le commerçant sait, sans calculer de tête, ce
qu'il a vendu, ce qui lui reste, et qui lui doit de l'argent.

## Positioning

Ce qu'un produit voisin ne pourrait pas copier sans changer de modèle :

- **Aucune intelligence artificielle payante, nulle part.** Prévisions,
  alertes, suggestions et commande vocale reposent sur des règles métier, des
  statistiques classiques, les données locales et les technologies natives du
  navigateur. Il n'existe aucun abonnement à un tiers, aucune facturation à la
  requête, donc aucun coût qui augmente avec l'usage.
- **Encaissement par mobile money, validé à la main.** Le commerçant envoie son
  abonnement sur un numéro Wave ou Orange Money et dépose une preuve ; un
  administrateur la valide. Pas de carte bancaire exigée, pas de passerelle
  imposée.
- **Plusieurs boutiques sous un même compte**, la seconde et les suivantes
  facturées à 75 % du tarif existant, tableaux de bord séparés.

## Operating Context

- **Zone franc CFA, toute la sous-région.** Marché visé : l'ensemble de la
  zone, pas un pays. Les écrans de paiement proposent Sénégal, Côte d'Ivoire,
  Mali, Bénin, Burkina Faso, Guinée, Togo, Niger, et « Autre ». Conséquence
  directe : aucun opérateur ne doit être mis en avant par défaut, aucune ville
  ne doit servir d'exemple implicite. Wave domine au Sénégal, Orange Money en
  Côte d'Ivoire ; l'ordre d'affichage ne peut pas être figé sur un pays.
- **Les vitrines de démonstration couvrent la sous-région**, et doivent le
  rester : Abidjan, Dakar, Ouagadougou côté Restaurant ; Bamako, Cotonou,
  Abidjan, Lomé, Dakar, Ouagadougou et Douala côté Boutique. Aucune ville ne
  doit redevenir le décor par défaut au fil des ajouts.
- **Deux francs CFA, pas un.** Les huit pays de l'UEMOA emploient le franc CFA
  d'Afrique de l'Ouest (XOF), le Cameroun celui d'Afrique centrale (XAF) : même
  nom courant, même valeur face à l'euro, monnaies distinctes. La vitrine de
  Douala est en XAF pour cette raison. À noter : les écrans de paiement
  d'abonnement ne listent aujourd'hui que des pays de l'UEMOA, plus « Guinée »
  — qui n'emploie pas le franc CFA — et « Autre ». Un commerçant camerounais
  passerait donc par « Autre ». Périmètre à trancher.
- **Téléphone d'abord, connexion irrégulière.** Les ventes se saisissent hors
  ligne dans une file d'attente locale qui se synchronise au retour du réseau.
  Le tableau de bord Boutique est installable en application (manifeste + agent
  de service).
- **Le mobile money est le moyen de paiement de référence**, pour l'abonnement
  comme pour les encaissements en boutique : espèces, Orange Money, Moov Money,
  Wave, carte.

## Capabilities and Constraints

Confirmé et en service :

- Isolation stricte entre tenants : le tenant est toujours résolu côté serveur
  depuis la session, jamais depuis un identifiant envoyé par le client.
- Trois langues d'interface : français (par défaut), anglais, arabe — avec
  sens de lecture inversé pour l'arabe.
- Saisie hors ligne des ventes, avec file d'attente et synchronisation.
- Scanner de codes-barres, import/export Excel, commande vocale, tous locaux.
- Les tarifs ne sont jamais écrits en dur : ils vivent dans les plans et les
  réglages de plateforme.
- Aucun identifiant de paiement en dur dans le code.

Contraintes durables que tout travail futur doit respecter :

- **Aucune IA payante, aucune dépendance facturée à l'usage.**
- Aucun bouton ni aucune donnée factice : ce qui est affiché existe.
- Un tarif ou un seuil se règle, il ne se code pas.

## Brand Commitments

- Nom : **MagyaPro**, décliné en « MagyaPro Restaurant » et « MagyaPro
  Boutique ».
- Le logo fourni par le propriétaire fait foi ; il est stocké côté plateforme
  et réglable depuis l'administration.
- Interface en français par défaut, adressée à des commerçants non techniciens.

## Evidence on Hand

**Rien n'est encore vendu.** Les comptes présents en base — restaurants,
boutiques, utilisateurs — sont des tests et des vitrines de démonstration du
propriétaire. Les montants visibles dans l'administration proviennent de ces
mêmes tests.

Conséquence, à respecter strictement : aucune page publique ne peut afficher un
nombre de clients, un témoignage, un logo de référence, un chiffre d'affaires
traité ou une durée d'existence. Ces preuves n'existent pas encore et ne
doivent pas être inventées, même sous forme d'exemple ou de remplissage.

Ce qui peut être montré sans mentir : les vitrines de démonstration, qui sont
identifiées comme telles en base (`isDemo`).

## Product Principles

1. **Répondre à la question posée, à l'écran où elle se pose.** « Qui me doit
   de l'argent », « est-ce que ce client paie », « que dois-je recommander » :
   chacune doit trouver sa réponse sans changer de page ni calculer de tête.
2. **Le patron consulte, l'employé saisit.** Un même écran sert rarement bien
   les deux ; quand il le faut, c'est la saisie qui commande la disposition et
   la consultation qui s'adapte.
3. **Ce qui coûte à l'usage est exclu.** La contrainte d'absence d'IA payante
   n'est pas une limite technique à contourner, c'est le modèle économique.
4. **Un chiffre affiché est un chiffre vérifiable.** Pas de projection
   présentée comme un relevé, pas de comparaison entre périodes inégales, pas
   de total qui additionne des devises différentes.
5. **Neutre sur toute la zone.** Aucun pays, aucun opérateur, aucune ville ne
   sert de référence par défaut.

## Accessibility & Inclusion

Aucune exigence spécifique n'a été établie avec le propriétaire à ce jour.

Deux faits produits existants en tiennent lieu et doivent être préservés : le
sens de lecture inversé pour l'arabe, et la commande vocale locale, qui ouvre
une voie de saisie sans clavier.
