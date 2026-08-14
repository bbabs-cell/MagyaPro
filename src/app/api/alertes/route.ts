import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

/**
 * Centre d'alertes : tout ce qui attend une action du personnel, dans un seul
 * appel. D'autres sources (livraisons) s'ajouteront ici au fur et à mesure
 * qu'elles seront construites — la forme de la réponse ne changera pas,
 * seuls les tableaux se rempliront.
 */
export const GET = route(async () => {
  const { restaurant } = await requireTenant('orders:view');

  const [pendingOrders, tableCalls, pendingReservations, paymentProofs] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId: restaurant.id, status: 'NEW' },
      orderBy: { placedAt: 'asc' },
      select: { id: true, number: true, total: true, currency: true, placedAt: true },
    }),
    prisma.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        type: { in: ['TABLE_CALL', 'TABLE_BILL_REQUEST'] },
        readAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, body: true, createdAt: true },
    }),
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, status: 'PENDING' },
      orderBy: { reservedFor: 'asc' },
      select: { id: true, customerName: true, partySize: true, reservedFor: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId: restaurant.id, status: 'PROCESSING', proofImageUrl: { not: null } },
      orderBy: { proofSubmittedAt: 'asc' },
      include: { order: { select: { id: true, number: true } } },
    }),
  ]);

  return ok({
    orders: pendingOrders,
    tableCalls,
    reservations: pendingReservations,
    paymentProofs: paymentProofs.map((payment) => ({
      id: payment.id,
      orderId: payment.order?.id ?? null,
      orderNumber: payment.order?.number ?? null,
      provider: payment.provider,
      amount: payment.amount,
      currency: payment.currency,
      proofImageUrl: payment.proofImageUrl,
    })),
    total:
      pendingOrders.length + tableCalls.length + pendingReservations.length + paymentProofs.length,
  });
});
