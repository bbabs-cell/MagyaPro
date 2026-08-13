import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

type Params = { params: Promise<{ orderId: string }> };

/**
 * Statut d'une commande, pour le suivi en temps réel côté client.
 *
 * Route publique, non authentifiée : le client n'a pas de compte. Sa seule
 * protection est l'identifiant de commande lui-même — un cuid de 25
 * caractères, non énumérable. Aucune autre information n'y donne accès (pas
 * de recherche par numéro ni par téléphone), et la réponse ne contient que ce
 * qu'un client voit déjà sur sa page de confirmation : rien qui identifierait
 * un autre client ni qui révélerait la marge ou les notes internes du
 * restaurant.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      fulfillmentType: true,
      cancelReason: true,
      statusUpdatedAt: true,
      deliveryCode: true,
      events: {
        orderBy: { createdAt: 'asc' },
        select: { toStatus: true, note: true, createdAt: true },
      },
    },
  });

  if (!order) throw new NotFoundError('Commande introuvable.');

  return ok({
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentType: order.fulfillmentType,
    cancelReason: order.cancelReason,
    statusUpdatedAt: order.statusUpdatedAt,
    // Utile au client une fois la commande prête à partir : c'est le code
    // qu'il donnera au livreur pour confirmer la remise.
    deliveryCode: order.fulfillmentType === 'DELIVERY' ? order.deliveryCode : null,
    events: order.events,
  });
});
