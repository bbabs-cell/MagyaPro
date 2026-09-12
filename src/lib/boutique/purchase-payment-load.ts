import { prisma } from '@/lib/db';

import { purchaseBalance, type PurchaseBalance } from '@/lib/boutique/purchase-payment';

/**
 * Chargement des soldes fournisseurs.
 *
 * Séparé de `purchase-payment.ts`, qui reste pur : la règle de calcul est
 * importable par un composant client, cette lecture-ci ne l'est pas. C'est la
 * même séparation que `expiry.ts` face à `expiry-load.ts`.
 */

/**
 * Reste dû par fournisseur, sur l'ensemble de leurs commandes livrées.
 *
 * Porte sur toutes les commandes et non sur celles affichées à l'écran : la
 * page Achats borne son historique à quatre-vingt-dix jours, et une facture
 * impayée plus ancienne doit continuer de compter. Un montant dû qui
 * disparaîtrait avec le défilement de l'historique serait pire que pas de
 * montant du tout.
 */
export async function listSupplierBalances(storeId: string): Promise<Map<string, PurchaseBalance>> {
  const orders = await prisma.purchaseOrder.findMany({
    // Seules les commandes livrées, en tout ou partie, peuvent devoir un
    // montant : on ne doit rien pour une marchandise qui n'est pas arrivée.
    where: { storeId, status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } },
    select: {
      supplierId: true,
      items: {
        select: { quantityReceived: true, unitFactor: true, unitCost: true, discount: true },
      },
      payments: { select: { amount: true } },
    },
  });

  const totals = new Map<string, PurchaseBalance>();

  for (const order of orders) {
    const balance = purchaseBalance(order.items, order.payments);
    const current = totals.get(order.supplierId);

    if (!current) {
      totals.set(order.supplierId, { ...balance });
      continue;
    }

    current.due += balance.due;
    current.paid += balance.paid;
    current.remaining += balance.remaining;
    // L'état d'un fournisseur n'est pas la somme d'états : il reste quelque
    // chose à régler, ou plus rien.
    current.state = current.remaining > 0 ? 'unpaid' : 'paid';
  }

  return totals;
}
