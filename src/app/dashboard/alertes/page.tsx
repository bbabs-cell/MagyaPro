import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { AlertCenter } from '@/components/dashboard/alert-center';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'À traiter' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const { restaurant } = await requireTenant('orders:view');

  const [orders, tableCalls, reservations, paymentProofs] = await Promise.all([
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

  return (
    <>
      {/* Deux boîtes de réception cohabitent — celle-ci et « Notifications ».
          Chacune dit désormais ce qu'elle contient ET ce que contient l'autre :
          sans cela, on ouvre les deux à chaque fois pour être sûr. */}
      <PageHeader
        title="À traiter"
        description="Ce qui attend une action de votre part, maintenant : commandes à confirmer, appels de salle, réservations à valider, preuves de paiement à vérifier. L'historique complet, lui, est dans Notifications."
      />
      <AlertCenter
        orders={orders.map((o) => ({ ...o, placedAt: o.placedAt.toISOString() }))}
        tableCalls={tableCalls.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
        reservations={reservations.map((r) => ({ ...r, reservedFor: r.reservedFor.toISOString() }))}
        paymentProofs={paymentProofs.map((payment) => ({
          id: payment.id,
          orderId: payment.order?.id ?? null,
          orderNumber: payment.order?.number ?? null,
          provider: payment.provider,
          amount: payment.amount,
          currency: payment.currency,
          proofImageUrl: payment.proofImageUrl!,
        }))}
      />
    </>
  );
}
