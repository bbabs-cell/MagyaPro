import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { AdminNav } from '@/components/admin/nav';

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

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="border-b border-white/10">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-ink">
              M
            </span>
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
          </div>
        </div>

        <AdminNav />
      </header>

      <main id="contenu" className="container-page py-8">
        {children}
      </main>
    </div>
  );
}
