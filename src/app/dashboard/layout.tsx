import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser, requiresEmailVerification } from '@/lib/auth/session';
import { getTenantContext, listMemberships } from '@/lib/tenant';
import { countNewOrders, countPendingAlerts } from '@/lib/alerts';
import { countUnreadNotifications } from '@/lib/notifications';
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  getEntitlements,
  type Feature,
} from '@/lib/entitlements';
import { prisma } from '@/lib/db';
import { getActiveAnnouncements } from '@/lib/announcements';
import { platformLogoUrl } from '@/lib/storage';
import { DashboardShell } from '@/components/dashboard/shell';
import { ToastProvider } from '@/components/ui/toast';
import { SubscriptionWall } from '@/components/account/subscription-wall';

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

  // Abonnement obligatoire : passé l'essai et le délai de grâce, le tableau de
  // bord laisse place au mur de paiement. Seule la page d'abonnement reste
  // accessible — sans elle, le restaurateur ne pourrait pas régulariser.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const onSubscriptionPage = pathname.startsWith('/dashboard/abonnement');

  if (!entitlements.isActive && !onSubscriptionPage && !context.isSupportAccess) {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, product: 'RESTAURANT' },
      orderBy: { position: 'asc' },
    });

    return (
      <SubscriptionWall
        tenantName={context.restaurant.name}
        status={entitlements.status}
        subscribeHref="/dashboard/abonnement"
        featureLabel={(key) => FEATURE_LABELS[key as Feature] ?? key}
        limitLabel={(key) => LIMIT_LABELS[key as keyof typeof LIMIT_LABELS] ?? key}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          features: plan.features,
          limits: (plan.limits ?? {}) as Record<string, number | undefined>,
        }))}
      />
    );
  }

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
