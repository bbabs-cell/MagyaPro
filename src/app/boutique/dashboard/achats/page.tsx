import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { purchaseBalance } from '@/lib/boutique/purchase-payment';
import { listSupplierBalances } from '@/lib/boutique/purchase-payment-load';
import { toQty } from '@/lib/boutique/quantity';
import { PageHeader } from '@/components/ui';
import { PurchasesManager } from '@/components/boutique/purchases-manager';

export const metadata: Metadata = { title: 'Achats fournisseurs' };
export const dynamic = 'force-dynamic';

export default async function BoutiquePurchasesPage() {
  const context = await requireStore('purchases:view');

  /** Les commandes terminées ne remontent pas au-delà de quatre-vingt-dix jours. */
  const closedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [suppliers, variants, orders, warehouses] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: context.store.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.storeProductVariant.findMany({
      where: { product: { storeId: context.store.id } },
      // `cost` est le dernier coût d'achat enregistré du produit : il
      // pré-remplit la ligne de commande, pour ne pas ressaisir un prix que
      // le produit connaît déjà. Zéro quand il n'a jamais été renseigné — on
      // laisse alors le champ à zéro plutôt que d'inventer un montant.
      select: {
        id: true,
        cost: true,
        product: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: { product: { name: 'asc' } },
    }),
    // Les commandes ouvertes sont chargées en entier : ce sont celles qui
    // demandent une action, aucune ne doit disparaître derrière une limite.
    // Les commandes closes, elles, sont bornées — un historique d'achats grossit
    // indéfiniment, et tout envoyer au navigateur à chaque visite finirait par
    // rendre la page inutilisable sur une connexion lente.
    prisma.purchaseOrder.findMany({
      where: {
        storeId: context.store.id,
        OR: [
          { status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] } },
          { status: { in: ['RECEIVED', 'CANCELLED'] }, createdAt: { gte: closedSince } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
        items: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityReceived: true,
            unitFactor: true,
            unitCost: true,
            discount: true,
            productVariant: { select: { product: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.warehouse.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
  ]);

  // Reste dû par fournisseur, sur toutes leurs commandes livrées — y compris
  // celles que l'historique de cette page ne montre plus.
  const balances = await listSupplierBalances(context.store.id);

  return (
    <>
      <PageHeader
        title="Achats fournisseurs"
        description="Vos commandes en cours d'abord, puis les trois derniers mois."
      />
      <PurchasesManager
        initialSuppliers={suppliers.map((supplier) => ({
          ...supplier,
          outstanding: balances.get(supplier.id)?.remaining ?? 0,
        }))}
        initialProducts={variants.map((v) => ({
          variantId: v.id,
          name: v.product.name,
          categoryName: v.product.category?.name ?? null,
          cost: v.cost,
        }))}
        initialOrders={orders.map((order) => ({
          id: order.id,
          reference: order.reference,
          status: order.status,
          extraFees: order.extraFees,
          expectedAt: order.expectedAt?.toISOString() ?? null,
          supplier: order.supplier,
          payment: purchaseBalance(order.items, order.payments),
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productVariant.product.name,
            quantityOrdered: toQty(item.quantityOrdered),
            quantityReceived: toQty(item.quantityReceived),
            unitFactor: toQty(item.unitFactor),
            unitCost: item.unitCost,
            discount: item.discount,
          })),
        }))}
        warehouses={warehouses}
        currency={context.store.currency}
        canManage={context.permissions.has('purchases:manage')}
        // Figé côté serveur : calculé dans le navigateur, le retard changerait
        // selon l'horloge du téléphone et différerait d'un appareil à l'autre.
        today={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}
