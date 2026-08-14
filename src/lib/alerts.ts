import { prisma } from '@/lib/db';

/**
 * Commandes reçues mais pas encore prises en charge par le restaurant.
 *
 * Sert de compteur au badge de navigation « Commandes » : il diminue
 * naturellement au fur et à mesure que le personnel fait avancer leur statut,
 * plutôt que de dépendre d'un marquage « lu » séparé que rien ne déclenchait.
 */
export async function countNewOrders(restaurantId: string): Promise<number> {
  return prisma.order.count({ where: { restaurantId, status: 'NEW' } });
}

/**
 * Nombre d'éléments en attente au centre d'alertes.
 *
 * Partagé entre le badge de navigation (`DashboardShell`) et la page
 * `/dashboard/alertes` : les deux comptent exactement la même chose.
 */
export async function countPendingAlerts(restaurantId: string): Promise<number> {
  const [orders, tableCalls, reservations, paymentProofs] = await Promise.all([
    countNewOrders(restaurantId),
    prisma.notification.count({
      where: { restaurantId, type: { in: ['TABLE_CALL', 'TABLE_BILL_REQUEST'] }, readAt: null },
    }),
    prisma.reservation.count({ where: { restaurantId, status: 'PENDING' } }),
    prisma.payment.count({
      where: { restaurantId, status: 'PROCESSING', proofImageUrl: { not: null } },
    }),
  ]);

  return orders + tableCalls + reservations + paymentProofs;
}
