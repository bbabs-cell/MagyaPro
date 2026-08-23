import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { PageHeader } from '@/components/ui';
import { OrdersManager } from '@/components/boutique/orders-manager';

export const metadata: Metadata = { title: 'Commandes en ligne' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueOrdersPage() {
  const context = await requireStore('orders:view');

  const orders = await prisma.storeOrder.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  });

  return (
    <>
      <PageHeader
        title="Commandes en ligne"
        description="Commandes passées depuis le site public — à retirer en boutique."
      />
      <div className="mt-6">
        <OrdersManager
          orders={orders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            items: order.items.map((item) => ({ ...item, quantity: toQty(item.quantity) })),
          }))}
          currency={context.store.currency}
        />
      </div>
    </>
  );
}
