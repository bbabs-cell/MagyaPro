'use client';

import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';

/**
 * Ossature minimale du tableau de bord MagyaPro Boutique — première version,
 * sans barre latérale : une seule page (vue d'ensemble) existe pour
 * l'instant. La navigation par rubriques (produits, stock, ventes...)
 * s'ajoutera au même rythme que les fonctionnalités correspondantes.
 */
export function DashboardShell({
  storeName,
  userName,
  userEmail,
  children,
}: {
  storeName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.replace('/boutique/connexion');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-surface-sunken text-ink">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight">{storeName}</p>
            <p className="truncate text-xs text-ink-faint">MagyaPro Boutique</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right text-xs text-ink-muted sm:block">
              <p className="font-medium text-ink">{userName}</p>
              <p>{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 items-center rounded-lg border border-surface-border px-3 text-sm hover:bg-surface-sunken"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-8">{children}</main>
    </div>
  );
}
