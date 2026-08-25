import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser, requiresEmailVerification } from '@/lib/auth/session';
import { getTenantContext, listMemberships } from '@/lib/tenant';
import { countNewOrders, countPendingAlerts } from '@/lib/alerts';
import { countUnreadNotifications } from '@/lib/notifications';
import { getEntitlements } from '@/lib/entitlements';
import { getActiveAnnouncements } from '@/lib/announcements';
import { platformLogoUrl } from '@/lib/storage';
import { DashboardShell } from '@/components/dashboard/shell';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  manifest: '/dashboard/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Magyapro', statusBarStyle: 'default' },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');

  // Un compte créé après l'introduction de la vérification obligatoire ne
  // peut pas utiliser le tableau de bord tant qu'il n'a pas confirmé son
  // adresse — sans quoi n'importe qui pourrait s'inscrire avec l'email de
  // quelqu'un d'autre.
  if (requiresEmailVerification(user)) redirect('/verifier-email');

  const context = await getTenantContext();

  // Un compte sans restaurant ne peut rien faire du dashboard : il est renvoyé
  // vers la création. Le Super Admin, lui, a son propre espace.
  if (!context) {
    redirect(user.platformRole === 'SUPER_ADMIN' ? '/admin' : '/bienvenue');
  }

  // L'onboarding inachevé reprend là où il s'est arrêté, sauf en accès support.
  if (!context.restaurant.onboardingCompletedAt && !context.isSupportAccess) {
    redirect('/bienvenue');
  }

  const [memberships, unreadCount, alertCount, notificationCount, entitlements, announcements] =
    await Promise.all([
      listMemberships(),
      countNewOrders(context.restaurant.id),
      countPendingAlerts(context.restaurant.id),
      countUnreadNotifications(context.restaurant.id),
      getEntitlements(context.restaurant.id),
      getActiveAnnouncements('RESTAURANT'),
    ]);

  return (
    <ToastProvider>
      <DashboardShell
        platformLogoUrl={platformLogoUrl()}
        role={context.role}
        user={{ name: user.name, email: user.email, isSuperAdmin: user.platformRole === 'SUPER_ADMIN' }}
        restaurant={{
          id: context.restaurant.id,
          name: context.restaurant.name,
          slug: context.restaurant.slug,
          logoUrl: context.restaurant.logoUrl,
          status: context.restaurant.status,
        }}
        memberships={memberships.map((m) => ({
          id: m.restaurant.id,
          name: m.restaurant.name,
          slug: m.restaurant.slug,
        }))}
        permissions={[...context.permissions]}
        unreadCount={unreadCount}
        alertCount={alertCount}
        notificationCount={notificationCount}
        subscription={{
          planName: entitlements.planName,
          status: entitlements.status,
          isActive: entitlements.isActive,
        }}
        isSupportAccess={context.isSupportAccess}
        announcements={announcements}
      >
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
