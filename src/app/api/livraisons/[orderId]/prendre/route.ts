import { ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { claimDelivery } from '@/lib/orders/service';

type Params = { params: Promise<{ orderId: string }> };

export const POST = route(async (_request, { params }: Params) => {
  const { restaurant, user } = await requireTenant('deliveries:drive');
  const { orderId } = await params;

  const order = await claimDelivery({
    restaurantId: restaurant.id,
    orderId,
    courierId: user.id,
    courierEmail: user.email,
  });

  return ok({ order });
});
