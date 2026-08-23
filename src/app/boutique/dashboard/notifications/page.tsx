import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { NotificationsPanel } from '@/components/boutique/notifications-panel';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueNotificationsPage() {
  const context = await requireStore('store:view');

  const notifications = await prisma.notification.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Commandes, stock faible ou en rupture, paiements reçus, abonnement."
      />
      <NotificationsPanel
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
