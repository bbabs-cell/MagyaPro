import { prisma } from '@/lib/db';

/**
 * Nombre d'éléments en attente au centre d'alertes.
 *
 * Partagé entre le badge de navigation (`DashboardShell`) et la page
 * `/dashboard/alertes` : les deux comptent exactement la même chose.
 */
export async function countPendingAlerts(restaurantId: string): Promise<number> {
  const [orders, tableCalls, reservations, paymentProofs] = await Promise.all([
    prisma.order.count({ where: { restaurantId, status: 'NEW' } }),
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
