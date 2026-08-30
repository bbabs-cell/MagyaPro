import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { getDemoTourContext, getStoreContext, listStoreMemberships } from '@/lib/boutique/store-tenant';
import { getActiveAnnouncements } from '@/lib/announcements';
import { platformLogoUrl } from '@/lib/storage';
import { DashboardShell } from './shell';
import { SubscriptionWall } from '@/components/account/subscription-wall';
import { StoreSubscriptionPaymentFlow } from '@/components/boutique/subscription-payment-flow';
import { WallStoreSwitcher } from '@/components/boutique/wall-store-switcher';
import { loadStoreSubscriptionScreen } from '@/lib/boutique/subscription-screen';
import {
  STORE_FEATURE_LABELS,
  STORE_LIMIT_LABELS,
  getStoreEntitlements,
  type StoreFeature,
} from '@/lib/boutique/entitlements';

export const metadata: Metadata = {
  title: { template: '%s — MagyaPro Boutique', default: 'Tableau de bord' },
  manifest: '/boutique/dashboard/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MagyaPro Boutique', statusBarStyle: 'default' },
};

export default async function BoutiqueDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    // Aucune session : seule une visite guidée d'une boutique de
    // démonstration est acceptée ici (voir `getDemoTourContext`) — tout
    // autre visiteur anonyme repart vers la connexion.
    const demoContext = await getDemoTourContext();
    if (!demoContext) redirect('/boutique/connexion');

    const unreadNotifications = await prisma.notification.count({
      where: { storeId: demoContext.store.id, readAt: null },
    });

    return (
      <DashboardShell
        platformLogoUrl={platformLogoUrl()}
        storeId={demoContext.store.id}
        storeName={demoContext.store.name}
        storeStatus={demoContext.store.status}
        stores={[]}
        unreadNotifications={unreadNotifications}
        userName={demoContext.user.name}
        userEmail={demoContext.user.email}
        isSupportAccess={false}
        isDemoTour
        announcements={[]}
      >
        {children}
      </DashboardShell>
    );
  }

  // `getStoreContext`/`listStoreMemberships` sont mémorisées par requête
  // (`cache()`) et n'ont pas de dépendance l'une envers l'autre — les lancer
  // en parallèle plutôt qu'en série évite un aller-retour base de données
  // inutile à chaque navigation dans le tableau de bord.
  const [context, allMemberships] = await Promise.all([getStoreContext(), listStoreMemberships()]);
  if (!context) redirect('/boutique/bienvenue');

  // L'onboarding inachevé reprend là où il s'est arrêté, sauf en accès support.
  if (!context.store.onboardingCompletedAt && !context.isSupportAccess) {
    redirect('/boutique/bienvenue');
  }

  const memberships = context.isSupportAccess ? [] : allMemberships;
  const [unreadNotifications, announcements, entitlements] = await Promise.all([
    prisma.notification.count({ where: { storeId: context.store.id, readAt: null } }),
    getActiveAnnouncements('STORE'),
    getStoreEntitlements(context.store.id),
  ]);

  // Abonnement obligatoire : passé l'essai et le délai de grâce, le tableau de
  // bord laisse place au mur de paiement. Seule la page d'abonnement reste
  // accessible — sans elle, le commerçant ne pourrait pas régulariser. L'accès
  // support de l'administration reste ouvert, précisément pour aider dans ce
  // cas-là.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const onSubscriptionPage = pathname.startsWith('/boutique/dashboard/abonnement');

  if (!entitlements.isActive && !onSubscriptionPage && !context.isSupportAccess) {
    // Le paiement se fait sur le mur lui-même, pas derrière un lien. Quelqu'un
    // qui vient de lire qu'il doit régler sa boutique ne devrait pas avoir à
    // trouver un autre écran pour le faire, ni à comprendre que « Choisir un
    // plan et payer » menait ailleurs. Les données sont chargées par la même
    // fonction que la page Abonnement : les deux écrans annoncent forcément
    // les mêmes plans aux mêmes montants.
    const screen = await loadStoreSubscriptionScreen(context.store.id);

    // Les autres boutiques du compte, pour ne pas laisser le commerçant
    // enfermé sur celle qu'il n'a pas réglée. Leur état d'abonnement est lu en
    // une seule requête plutôt qu'une par boutique : c'est une information de
    // confort, elle ne doit pas coûter un aller-retour par ligne affichée.
    const otherMemberships = allMemberships.filter((m) => m.store.id !== context.store.id);
    const otherSubscriptions = otherMemberships.length
      ? await prisma.storeSubscription.findMany({
          where: { storeId: { in: otherMemberships.map((m) => m.store.id) } },
          select: { storeId: true, status: true, currentPeriodEnd: true },
        })
      : [];
    const usableStoreIds = new Set(
      otherSubscriptions
        .filter(
          (sub) =>
            (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
            sub.currentPeriodEnd.getTime() > Date.now(),
        )
        .map((sub) => sub.storeId),
    );

    return (
      <SubscriptionWall
        tenantName={context.store.name}
        status={entitlements.status}
        // Aucun plan n'a jamais été souscrit : c'est une boutique
        // supplémentaire, ouverte sans essai. Le mur le dit autrement.
        neverSubscribed={entitlements.planKey === null}
        subscribeHref="/boutique/dashboard/abonnement"
        featureLabel={(key) => STORE_FEATURE_LABELS[key as StoreFeature] ?? key}
        limitLabel={(key) => STORE_LIMIT_LABELS[key as keyof typeof STORE_LIMIT_LABELS] ?? key}
        plans={[]}
        footerSlot={
          <WallStoreSwitcher
            stores={otherMemberships.map((m) => ({
              id: m.store.id,
              name: m.store.name,
              usable: usableStoreIds.has(m.store.id),
            }))}
          />
        }
        paymentSlot={
          <StoreSubscriptionPaymentFlow
            canManage={context.permissions.has('subscription:manage')}
            currentPlanKey={screen.currentPlanKey}
            availableProviders={screen.availableProviders}
            pendingPayment={screen.pendingPayment}
            billing={screen.billing}
            plans={screen.plans}
          />
        }
      />
    );
  }

  return (
    <>
      {/* Applique le thème mémorisé avant le premier rendu : sans ça, une
          boutique en thème sombre verrait un éclair clair à chaque
          chargement de page. Le composant `useBoutiqueTheme` reprend ensuite
          la main, et retire l'attribut en quittant le tableau de bord. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var t=localStorage.getItem('magyapro:boutique-theme');document.documentElement.dataset.boutiqueTheme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.boutiqueTheme='light'}",
        }}
      />
      <DashboardShell
        platformLogoUrl={platformLogoUrl()}
        storeId={context.store.id}
        storeName={context.store.name}
        storeStatus={context.store.status}
        stores={memberships.map((m) => ({ id: m.store.id, name: m.store.name, role: m.role }))}
        // Ouvrir une boutique engage une dépense mensuelle : seul le
        // propriétaire de celle-ci le décide, jamais un administrateur ni un
        // Super Admin venu dépanner.
        canAddStore={!context.isSupportAccess && context.role === 'OWNER'}
        unreadNotifications={unreadNotifications}
        userName={user.name}
        userEmail={user.email}
        isSupportAccess={context.isSupportAccess}
        announcements={announcements}
      >
        {children}
      </DashboardShell>
    </>
  );
}
