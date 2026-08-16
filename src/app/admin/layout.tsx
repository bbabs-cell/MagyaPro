import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { AdminSidebar } from '@/components/admin/sidebar';
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
    <div className="relative min-h-screen overflow-x-hidden bg-navy text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-[#ff5e2e] opacity-[0.12] blur-[120px]"
      />

      <div className="relative lg:flex">
        <AdminSidebar logoUrl={logoUrl} userEmail={user.email} />

        <main id="contenu" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
