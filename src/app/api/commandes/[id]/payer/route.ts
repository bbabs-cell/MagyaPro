import { ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { markOrderPaid } from '@/lib/orders/service';
import { currentClientIp } from '@/lib/auth/session';

type Params = { params: Promise<{ id: string }> };

/**
 * Constate l'encaissement d'une commande, **sans changer son statut**.
 *
 * Cette route terminait aussi la commande, parce que le seul cas prévu était
 * la livraison : le livreur rapportait l'argent, on encaissait et on clôturait
 * d'un geste. Une commande emportée au comptoir n'a jamais de livreur, donc
 * jamais d'encaissement possible — voir `markOrderPaid`.
 *
 * Terminer une commande marque désormais son paiement de toute façon ; les
 * deux gestes restent séparés parce qu'ils ne surviennent pas toujours
 * ensemble ni dans le même ordre.
 */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireTenant('orders:update_status');
  const { id } = await params;

  const order = await markOrderPaid({
    restaurantId: context.restaurant.id,
    orderId: id,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    ip: await currentClientIp(),
  });

  return ok({ order });
});
