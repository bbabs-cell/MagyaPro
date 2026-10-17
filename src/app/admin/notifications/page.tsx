import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import { listPlatformNotifications } from '@/lib/platform-notifications';
import { PlatformNotificationsPanel } from '@/components/admin/platform-notifications-panel';
import { DomainHeading } from '@/components/admin/domain';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  await requireSuperAdmin();
  const notifications = await listPlatformNotifications();

  return (
    <>
      <DomainHeading as="h1" domain="comm" className="text-2xl font-semibold tracking-tight">
        Notifications
      </DomainHeading>
      <p className="mt-1 text-sm text-fg/60">
        Les événements de la plateforme qui demandent votre intervention.
      </p>

      <PlatformNotificationsPanel
        notifications={notifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
