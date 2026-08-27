import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { getDemoTourContext, getStoreContext, listStoreMemberships } from '@/lib/boutique/store-tenant';
import { getActiveAnnouncements } from '@/lib/announcements';
import { platformLogoUrl } from '@/lib/storage';
import { DashboardShell } from './shell';

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
        canManageApi={false}
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
  const [unreadNotifications, announcements] = await Promise.all([
    prisma.notification.count({ where: { storeId: context.store.id, readAt: null } }),
    getActiveAnnouncements('STORE'),
  ]);

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
        unreadNotifications={unreadNotifications}
        canManageApi={context.permissions.has('api:manage')}
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
