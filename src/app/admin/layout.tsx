import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { AdminThemeRoot } from '@/components/admin/theme-root';
import { platformLogoUrl } from '@/lib/storage';

/**
 * Espace d'administration de la plateforme.
 *
 * Entièrement séparé du dashboard restaurant : ni la même navigation, ni les
 * mêmes routes, ni les mêmes contrôles d'accès. Le garde ci-dessous est le
 * premier verrou ; chaque route d'API `/api/admin/*` revérifie le rôle de son
 * côté, car un garde de layout ne protège pas les API.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect('/connexion');
  if (user.platformRole !== 'SUPER_ADMIN') redirect('/dashboard');

  const logoUrl = platformLogoUrl();

  return (
    <AdminThemeRoot logoUrl={logoUrl} userEmail={user.email}>
      {children}
    </AdminThemeRoot>
  );
}
