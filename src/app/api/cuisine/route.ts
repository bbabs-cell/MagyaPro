import { ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { listKitchenOrders } from '@/lib/kitchen';

/**
 * File de la cuisine, interrogée toutes les douze secondes par l'écran de
 * préparation. Elle partage sa lecture avec la page (`lib/kitchen`), pour que
 * le contenu ne change pas au premier rafraîchissement automatique.
 */
export const GET = route(async () => {
  const { restaurant } = await requireTenant('orders:update_status');
  const orders = await listKitchenOrders(restaurant.id);
  return ok({ orders });
});
