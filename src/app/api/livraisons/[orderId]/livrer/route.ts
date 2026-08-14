import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { deliveryConfirmationSchema } from '@/lib/validation';
import { confirmDelivery } from '@/lib/orders/service';
import { currentClientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

type Params = { params: Promise<{ orderId: string }> };

export const POST = route(async (request, { params }: Params) => {
  const { restaurant, user } = await requireTenant('deliveries:drive');
  const { orderId } = await params;
  const input = parseOrThrow(deliveryConfirmationSchema, await readJson(request));

  // Le code à six chiffres protège contre une remise à la mauvaise personne :
  // limiter les tentatives par commande empêche de le deviner par essais
  // successifs.
  hit(`delivery-code:${orderId}`, RATE_LIMITS.deliveryCode);

  const order = await confirmDelivery({
    restaurantId: restaurant.id,
    orderId,
    courierId: user.id,
    courierEmail: user.email,
    code: input.code,
    ip: await currentClientIp(),
  });

  return ok({ order });
});
