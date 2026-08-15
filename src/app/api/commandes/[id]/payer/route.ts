import { ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { confirmDeliveryPayment } from '@/lib/orders/service';
import { currentClientIp } from '@/lib/auth/session';

type Params = { params: Promise<{ id: string }> };

/**
 * Confirme que le restaurant a bien reçu l'argent du livreur, et termine la
 * commande dans le même geste. Seule façon de faire passer une commande
 * « Livrée » à « Terminée » — voir `confirmDeliveryPayment`.
 */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireTenant('orders:update_status');
  const { id } = await params;

  const order = await confirmDeliveryPayment({
    restaurantId: context.restaurant.id,
    orderId: id,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    ip: await currentClientIp(),
  });

  return ok({ order });
});
