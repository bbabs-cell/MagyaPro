import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getTenantContext } from '@/lib/tenant';
import { DocumentShell } from '@/components/documents/shell';

/**
 * Reçus imprimables Restaurant — volontairement hors de `/dashboard`.
 * L'accès reste protégé de la même façon : compte connecté, restaurant
 * associé. La mise en page est celle, partagée, de `DocumentShell`.
 */
export default async function RecuLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');

  const context = await getTenantContext();
  if (!context) redirect('/dashboard');

  return <DocumentShell>{children}</DocumentShell>;
}
