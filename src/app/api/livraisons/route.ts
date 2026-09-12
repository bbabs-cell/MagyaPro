import { ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { listCourierDeliveries } from '@/lib/deliveries';

/**
 * Livraisons visibles par un livreur : les courses libres à prendre, et les
 * siennes en cours. Jamais les livraisons prises en charge par un collègue.
 *
 * Interrogée toutes les quinze secondes par l'écran de tournée. Elle partage
 * sa lecture avec la page elle-même (`lib/deliveries`), pour que le contenu ne
 * change pas au premier rafraîchissement automatique.
 */
export const GET = route(async () => {
  const { restaurant, user } = await requireTenant('deliveries:drive');
  const { pool, mine } = await listCourierDeliveries({
    restaurantId: restaurant.id,
    courierId: user.id,
  });
  return ok({ pool, mine });
});
