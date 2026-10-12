# Transferts de stock entre boutiques

Écran : **Ma boutique → Transferts** (`/boutique/dashboard/transferts`). Le lien n'apparaît que pour un
compte qui a au moins deux boutiques.

## Déroulé

1. **Envoi.** Depuis la boutique de départ, avec la permission `inventory:transfer`, on choisit la
   boutique d'arrivée, puis les produits et leurs quantités (en cartons ou à l'unité). Le stock **sort
   aussitôt** (`TRANSFER_OUT`) : la marchandise n'est plus en rayon. La boutique d'arrivée reçoit une
   notification « Transfert en route ».
2. **Réception.** Dans la boutique d'arrivée, avec la permission `inventory:transfer` ou
   `inventory:manage`, on appuie sur « Réceptionner » quand la marchandise est là. Le stock **entre**
   (`TRANSFER_IN`). Tant que personne ne réceptionne, rien n'entre : un carton perdu en route ne gonfle
   pas le stock.
3. **Annulation.** Un envoi encore en route peut être annulé depuis la boutique de départ, et le stock y
   revient.

Une seule réception ou annulation par transfert est possible : le changement de statut est conditionnel
(`updateMany … where status = IN_TRANSIT`), donc un double toucher sur deux téléphones ne peut pas compter
deux fois.

## Les catalogues restent séparés

Chaque boutique a ses propres fiches. À la réception, chaque produit est rapproché d'une fiche de la
boutique d'arrivée, dans cet ordre :

1. même **code-barres** ;
2. même **référence** (SKU) ;
3. même **nom** (sans tenir compte des accents ni des majuscules) et même déclinaison.

Si aucune fiche ne correspond, elle est **créée par copie** : nom, prix, coût, code-barres, unités
(cartons…), catégorie retrouvée par son nom. Les prix de la copie peuvent ensuite être modifiés dans la
boutique d'arrivée.

Un rapprochement dont l'unité de stock diffère (bouteilles d'un côté, cartons de l'autre) est refusé avec
un message clair, plutôt que de faire entrer 24 cartons au lieu de 24 bouteilles.

## Droits

- **Envoi** : `inventory:transfer` dans la boutique de départ, plus `inventory:transfer` ou
  `inventory:manage` dans celle d'arrivée. L'identifiant de la boutique d'arrivée envoyé par le
  navigateur est toujours vérifié.
- **Réception** : `inventory:transfer` ou `inventory:manage` dans la boutique d'arrivée.
- **Annulation** : `inventory:transfer` dans la boutique de départ.

## Limites connues

- Les dates de péremption ne suivent pas la marchandise : le lot reste attaché à la boutique de départ.
- La réception porte sur tout le transfert. Un écart (casse en route) se corrige ensuite par un retrait
  ou un inventaire.
- **Aucune migration** : les tables `boutique_stock_transfers` existaient déjà.

Code : `src/lib/boutique/transfers-service.ts`, `src/app/api/boutique/transferts/`,
`src/components/boutique/transfers-manager.tsx`. Tests : `tests/stock-transfers.test.ts`.
