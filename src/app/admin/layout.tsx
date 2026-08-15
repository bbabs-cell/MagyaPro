import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { AdminNav } from '@/components/admin/nav';
import { AdminLogoutButton } from '@/components/admin/logout-button';
import { Logo } from '@/components/ui/logo';
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

      <header className="relative border-b border-white/10 bg-black/10 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo src={logoUrl} showText={false} className="h-8 w-8" />
            <span className="font-semibold tracking-tight">
              Magyapro <span className="font-normal text-white/60">Administration</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/60 sm:inline">{user.email}</span>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
            >
              Mon restaurant
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        <AdminNav />
      </header>

      <main id="contenu" className="relative container-page py-8">
        {children}
      </main>
    </div>
  );
}
