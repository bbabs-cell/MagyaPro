import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { PageHeader } from '@/components/ui';
import { NotificationsPanel } from '@/components/account/notifications-panel';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function RestaurantNotificationsPage() {
  const context = await requireTenant('restaurant:view');

  const notifications = await prisma.notification.findMany({
    where: { restaurantId: context.restaurant.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="L'historique de tout ce qui s'est passé : réservations, preuves de paiement, changements de réglages, abonnement. Ce qui réclame une action est regroupé dans « À traiter »."
      />
      <NotificationsPanel
        endpoint="/api/restaurant/notifications"
        notifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          href: n.href,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
