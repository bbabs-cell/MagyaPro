import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { KitchenBoard } from '@/components/dashboard/kitchen-board';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Cuisine' };
export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const { restaurant } = await requireTenant('orders:update_status');

  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id, status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
    orderBy: { placedAt: 'asc' },
    select: {
      id: true,
      number: true,
      status: true,
      fulfillmentType: true,
      placedAt: true,
      table: { select: { label: true } },
      items: {
        select: { id: true, productName: true, variantName: true, quantity: true, options: true },
      },
    },
  });

  return (
    <>
      <PageHeader title="Cuisine" description="Commandes déjà confirmées, prêtes à préparer." />
      <KitchenBoard
        initialOrders={orders.map((order) => ({
          ...order,
          status: order.status as 'CONFIRMED' | 'PREPARING' | 'READY',
          placedAt: order.placedAt.toISOString(),
        }))}
      />
    </>
  );
}
