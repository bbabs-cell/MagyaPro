import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext, listStoreMemberships } from '@/lib/boutique/store-tenant';
import { platformLogoUrl } from '@/lib/storage';
import { DashboardShell } from './shell';

export const metadata: Metadata = { title: { template: '%s — MagyaPro Boutique', default: 'Tableau de bord' } };

export default async function BoutiqueDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/boutique/connexion');

  const context = await getStoreContext();
  if (!context) redirect('/boutique/bienvenue');

  // L'onboarding inachevé reprend là où il s'est arrêté, sauf en accès support.
  if (!context.store.onboardingCompletedAt && !context.isSupportAccess) {
    redirect('/boutique/bienvenue');
  }

  const memberships = context.isSupportAccess ? [] : await listStoreMemberships();
  const unreadNotifications = await prisma.notification.count({
    where: { storeId: context.store.id, readAt: null },
  });

  return (
    <DashboardShell
      platformLogoUrl={platformLogoUrl()}
      storeId={context.store.id}
      storeName={context.store.name}
      storeStatus={context.store.status}
      stores={memberships.map((m) => ({ id: m.store.id, name: m.store.name, role: m.role }))}
      unreadNotifications={unreadNotifications}
      canManageApi={context.permissions.has('api:manage')}
      userName={user.name}
      userEmail={user.email}
      isSupportAccess={context.isSupportAccess}
    >
      {children}
    </DashboardShell>
  );
}
