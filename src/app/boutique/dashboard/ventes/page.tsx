import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { EmptyState, PageHeader } from '@/components/ui';
import { SalesManager } from '@/components/boutique/sales-manager';

export const metadata: Metadata = { title: 'Ventes' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSalesPage() {
  const context = await requireStore('sales:view');

  const sales = await prisma.sale.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: {
        select: { productVariantId: true, productName: true, variantLabel: true, quantity: true, unitPrice: true },
      },
      payments: { select: { method: true } },
      returns: { include: { items: { select: { productVariantId: true, quantity: true } } } },
    },
  });

  const salesForClient = sales.map((sale) => {
    const returnedByVariant: Record<string, number> = {};
    for (const storeReturn of sale.returns) {
      for (const item of storeReturn.items) {
        returnedByVariant[item.productVariantId] =
          (returnedByVariant[item.productVariantId] ?? 0) + item.quantity;
      }
    }
    return {
      id: sale.id,
      number: sale.number,
      createdAt: sale.createdAt.toISOString(),
      status: sale.status,
      total: sale.total,
      items: sale.items,
      payments: sale.payments,
      returnedByVariant,
    };
  });

  return (
    <>
      <PageHeader title="Ventes" description="Les 100 dernières ventes de la boutique." />

      {sales.length === 0 ? (
        <EmptyState
          title="Aucune vente pour le moment"
          description="Les ventes réalisées depuis la caisse apparaîtront ici."
        />
      ) : (
        <SalesManager sales={salesForClient} currency={context.store.currency} />
      )}
    </>
  );
}
