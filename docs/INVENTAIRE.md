# Inventaire guidé (Boutique)

Écran : **Ma boutique → Inventaire** (`/boutique/dashboard/inventaire`), aussi accessible depuis Produits
(« Faire l'inventaire »). Permission requise : `inventory:manage`.

## Déroulé

1. **Compter rayon par rayon.** Les rayons sont les catégories ; chaque pastille indique `comptés/total`.
   Un produit vendu au carton se compte en « cartons + bouteilles », sans calcul de tête.
   Recherche par nom, référence ou code-barres, et lecture au scanner.
2. **Comptage à l'aveugle par défaut.** Le stock attendu est masqué pour que l'on compte vraiment
   au lieu de recopier. « Afficher le stock attendu » le montre, avec l'écart et un bouton « Conforme ».
3. **Voir les écarts.** Le récapitulatif liste les produits dont le comptage diffère, triés par valeur.
   Il donne aussi la valeur au coût d'achat de ce qui manque et de ce qui est en trop.
4. **Valider.** Un mouvement « Ajustement » par écart, tous dans une seule transaction : l'inventaire
   s'applique entièrement ou pas du tout. Motif : « Inventaire : compté X, attendu Y — note ».
   Les corrections sont visibles dans **Entrées et sorties** (filtre Ajustement).

Les produits non comptés ne changent pas : on peut faire un inventaire partiel (un seul rayon).

## Choix techniques

- **On applique l'écart, pas le chiffre compté.** L'écart vaut `compté − attendu`, l'attendu étant figé
  au moment où la ligne est comptée. Une vente passée entre le comptage et la validation reste donc prise
  en compte (le chiffre compté l'aurait effacée).
- **Brouillon sur l'appareil** (`localStorage`, clé `magyapro:inventaire:<storeId>`) : un appel ou
  une batterie vide ne fait pas recommencer. Aucune table ni migration n'est nécessaire.
- **Pas d'alertes de rupture** pour ces corrections (`recordStockMovement({ silent: true })`) : l'équipe
  vient de compter elle-même.
- Le stock peut devenir négatif après correction si une vente a été enregistrée pour un article
  déjà décompté ; c'est préférable à refuser tout l'inventaire.

Code : `src/lib/boutique/stock-count.ts` (calculs), `src/lib/boutique/stock-count-service.ts`
(validation), `src/app/api/boutique/stock/inventaire/route.ts`, `src/components/boutique/stock-count.tsx`.
Tests : `tests/stock-count.test.ts`.
