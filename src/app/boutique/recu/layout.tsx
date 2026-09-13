import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext } from '@/lib/boutique/store-tenant';
import { DocumentShell } from '@/components/documents/shell';

/**
 * Reçus imprimables Boutique — même enveloppe que côté Restaurant, à la
 * protection d'accès près.
 */
export default async function BoutiqueRecuLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/boutique/connexion');

  const context = await getStoreContext();
  if (!context) redirect('/boutique/dashboard');

  return <DocumentShell>{children}</DocumentShell>;
}
