import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext } from '@/lib/boutique/store-tenant';
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

  if (!context.store.onboardingCompletedAt) redirect('/boutique/bienvenue');

  return (
    <DashboardShell
      platformLogoUrl={platformLogoUrl()}
      storeName={context.store.name}
      userName={user.name}
      userEmail={user.email}
    >
      {children}
    </DashboardShell>
  );
}
