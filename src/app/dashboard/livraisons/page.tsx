import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { DeliveryBoard } from '@/components/dashboard/delivery-board';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Mes livraisons' };
export const dynamic = 'force-dynamic';

const SELECT = {
  id: true,
  number: true,
  customerName: true,
  customerPhone: true,
  deliveryAddress: true,
  deliveryLat: true,
  deliveryLng: true,
  total: true,
  currency: true,
  placedAt: true,
  statusUpdatedAt: true,
} as const;

export default async function DeliveriesPage() {
  const { restaurant, user } = await requireTenant('deliveries:drive');

  const [pool, mine] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId: restaurant.id, fulfillmentType: 'DELIVERY', status: 'READY', courierId: null },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
    prisma.order.findMany({
      where: { restaurantId: restaurant.id, courierId: user.id, status: 'OUT_FOR_DELIVERY' },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
  ]);

  const serialize = (orders: typeof pool) =>
    orders.map((order) => ({
      ...order,
      placedAt: order.placedAt.toISOString(),
      statusUpdatedAt: order.statusUpdatedAt.toISOString(),
    }));

  return (
    <>
      <PageHeader
        title="Mes livraisons"
        description="Prenez une course, appelez le client, et confirmez la remise avec le code qu'il vous donne."
      />
      <DeliveryBoard initialPool={serialize(pool)} initialMine={serialize(mine)} />
    </>
  );
}
