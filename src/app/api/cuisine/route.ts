import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

/**
 * File de la cuisine : uniquement les commandes déjà confirmées.
 *
 * Une commande `NEW` attend encore une décision du restaurant (l'accepter ou
 * l'annuler) ; elle n'apparaît qu'au centre d'alertes et sur l'écran
 * Commandes, jamais ici — la cuisine ne doit jamais préparer un plat qui
 * pourrait encore être refusé.
 */
export const GET = route(async () => {
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

  return ok({ orders });
});
