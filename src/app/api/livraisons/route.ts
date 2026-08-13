import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

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

/**
 * Livraisons visibles par un livreur : les courses libres à prendre, et les
 * siennes en cours. Jamais les livraisons prises en charge par un collègue.
 */
export const GET = route(async () => {
  const { restaurant, user } = await requireTenant('deliveries:drive');

  const [pool, mine] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        fulfillmentType: 'DELIVERY',
        status: 'READY',
        courierId: null,
      },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        courierId: user.id,
        status: 'OUT_FOR_DELIVERY',
      },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
  ]);

  return ok({ pool, mine });
});
