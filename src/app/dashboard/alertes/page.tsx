import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { AlertCenter } from '@/components/dashboard/alert-center';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Alertes' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const { restaurant } = await requireTenant('orders:view');

  const [orders, tableCalls, reservations] = await Promise.all([
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
  ]);

  return (
    <>
      <PageHeader
        title="Centre d'alertes"
        description="Tout ce qui attend une action, au même endroit : commandes à confirmer, appels de salle, réservations à valider."
      />
      <AlertCenter
        orders={orders.map((o) => ({ ...o, placedAt: o.placedAt.toISOString() }))}
        tableCalls={tableCalls.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
        reservations={reservations.map((r) => ({ ...r, reservedFor: r.reservedFor.toISOString() }))}
      />
    </>
  );
}
