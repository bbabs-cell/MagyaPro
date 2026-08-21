'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { cx } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/boutique/dashboard', label: "Vue d'ensemble", exact: true },
  { href: '/boutique/dashboard/caisse', label: 'Caisse', exact: false },
  { href: '/boutique/dashboard/ventes', label: 'Ventes', exact: false },
  { href: '/boutique/dashboard/produits', label: 'Produits', exact: false },
  { href: '/boutique/dashboard/achats', label: 'Achats', exact: false },
  { href: '/boutique/dashboard/clients', label: 'Clients', exact: false },
  { href: '/boutique/dashboard/equipe', label: 'Équipe', exact: false },
];

/**
 * Ossature minimale du tableau de bord MagyaPro Boutique — navigation
 * horizontale simple tant que le nombre de rubriques reste faible ; une
 * vraie barre latérale (comme celle de Restaurant) prendra le relais quand
 * stock, ventes, achats, etc. rejoindront la liste.
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
  const pathname = usePathname();

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
        <nav aria-label="Navigation du tableau de bord" className="container-page flex gap-1 overflow-x-auto pb-2">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="container-page py-8">{children}</main>
    </div>
  );
}
