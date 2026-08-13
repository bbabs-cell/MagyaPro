'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { Badge, cx } from '@/components/ui';
import { AlertWatcher } from '@/components/dashboard/alert-watcher';
import type { Permission } from '@/lib/rbac';

/**
 * Ossature du dashboard restaurant.
 *
 * Mobile d'abord : la navigation principale est un tiroir sur petit écran et
 * une colonne fixe à partir de `lg`. Les entrées de menu sont filtrées par
 * permission — un employé ne voit pas les rubriques qu'il ne peut pas ouvrir.
 * Ce filtrage est un confort d'usage ; l'accès réel est refusé côté serveur.
 */

type NavItem = {
  href: string;
  label: string;
  permission?: Permission;
  exact?: boolean;
};

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Pilotage',
    items: [
      { href: '/dashboard', label: 'Vue d\'ensemble', exact: true },
      { href: '/dashboard/alertes', label: 'Alertes', permission: 'orders:view' },
      { href: '/dashboard/commandes', label: 'Commandes', permission: 'orders:view' },
      { href: '/dashboard/cuisine', label: 'Cuisine', permission: 'orders:update_status' },
      { href: '/dashboard/livraisons', label: 'Mes livraisons', permission: 'deliveries:drive' },
      { href: '/dashboard/reservations', label: 'Réservations', permission: 'reservations:manage' },
      { href: '/dashboard/clients', label: 'Clients', permission: 'customers:view' },
      { href: '/dashboard/statistiques', label: 'Statistiques', permission: 'analytics:view' },
    ],
  },
  {
    title: 'Restaurant',
    items: [
      { href: '/dashboard/menu', label: 'Menu', permission: 'menu:view' },
      { href: '/dashboard/salle', label: 'Salle', permission: 'tables:view' },
      { href: '/dashboard/apparence', label: 'Apparence', permission: 'restaurant:update' },
      { href: '/dashboard/livraison', label: 'Livraison', permission: 'delivery:manage' },
      { href: '/dashboard/promotions', label: 'Promotions', permission: 'promotions:manage' },
      { href: '/dashboard/avis', label: 'Avis', permission: 'reviews:moderate' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { href: '/dashboard/parametres', label: 'Réglages', permission: 'settings:manage' },
      { href: '/dashboard/equipe', label: 'Équipe', permission: 'team:view' },
      { href: '/dashboard/abonnement', label: 'Abonnement', permission: 'subscription:view' },
    ],
  },
];

export function DashboardShell({
  user,
  restaurant,
  memberships,
  permissions,
  unreadCount,
  alertCount,
  subscription,
  isSupportAccess,
  children,
}: {
  user: { name: string; email: string; isSuperAdmin: boolean };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    status: string;
  };
  memberships: Array<{ id: string; name: string; slug: string }>;
  permissions: string[];
  unreadCount: number;
  alertCount: number;
  subscription: { planName: string; status: string; isActive: boolean };
  isSupportAccess: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const allowed = new Set(permissions);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || allowed.has(item.permission),
    ),
  })).filter((section) => section.items.length > 0);

  function isActive(item: NavItem) {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.replace('/');
    router.refresh();
  }

  async function handleEndSupport() {
    await api.post('/api/admin/support-access/fin');
    router.replace('/admin');
    router.refresh();
  }

  async function switchRestaurant(restaurantId: string) {
    await api.post('/api/restaurant/actif', { restaurantId });
    router.refresh();
  }

  const navigation = (
    <nav className="space-y-6" aria-label="Navigation du tableau de bord">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {section.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={cx(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive(item)
                      ? 'bg-ink text-white'
                      : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                  )}
                >
                  {item.label}
                  {item.href === '/dashboard/commandes' && unreadCount > 0 && (
                    <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">
                      {unreadCount}
                    </span>
                  )}
                  {item.href === '/dashboard/alertes' && alertCount > 0 && (
                    <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                      {alertCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-sunken">
      {allowed.has('orders:view') && <AlertWatcher />}

      {/* Bandeau d'accès support : impossible à manquer, pour que
          l'administrateur sache qu'il agit dans l'espace d'un client. */}
      {isSupportAccess && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Accès support actif sur « {restaurant.name} ». Vos actions sont
          journalisées.{' '}
          <button
            type="button"
            onClick={handleEndSupport}
            className="underline underline-offset-2"
          >
            Quitter l&apos;accès support
          </button>
        </div>
      )}

      {restaurant.status === 'SUSPENDED' && (
        <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm text-white">
          Ce restaurant est suspendu : son site public est hors ligne et les
          modifications sont bloquées.
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-surface-border bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border"
          >
            <span className="sr-only">
              {menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            </span>
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
          <span className="truncate px-3 font-medium">{restaurant.name}</span>
          <Link
            href={`/r/${restaurant.slug}`}
            className="text-sm text-ink-muted underline underline-offset-4"
          >
            Site
          </Link>
        </div>
        {menuOpen && (
          <div id="menu-mobile" className="border-t border-surface-border bg-white p-4">
            {navigation}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-sunken"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </header>

      <div className="lg:flex">
        <aside className="hidden w-64 shrink-0 border-r border-surface-border bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <div className="flex h-full flex-col p-4">
            <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
                M
              </span>
              <span className="font-semibold tracking-tight">Magya</span>
            </Link>

            <div className="mt-4 rounded-xl border border-surface-border p-3">
              <p className="truncate text-sm font-medium">{restaurant.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-faint">
                {restaurant.slug}
              </p>

              {/* Le sélecteur n'apparaît que s'il y a un choix à faire. */}
              {memberships.length > 1 && (
                <select
                  aria-label="Changer de restaurant"
                  value={restaurant.id}
                  onChange={(event) => switchRestaurant(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-surface-border px-2 py-1.5 text-xs"
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {membership.name}
                    </option>
                  ))}
                </select>
              )}

              <Link
                href={`/r/${restaurant.slug}`}
                className="mt-2 block text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                Voir le site public
              </Link>
            </div>

            <div className="mt-6 flex-1">{navigation}</div>

            <div className="mt-6 border-t border-surface-border pt-4">
              <Link
                href="/dashboard/abonnement"
                className="block rounded-lg px-3 py-2 hover:bg-surface-sunken"
              >
                <p className="text-xs text-ink-faint">Abonnement</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm">
                  {subscription.planName}
                  {!subscription.isActive && <Badge tone="danger">Inactif</Badge>}
                </p>
              </Link>

              {user.isSuperAdmin && (
                <Link
                  href="/admin"
                  className="mt-1 block rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken"
                >
                  Administration Magya
                </Link>
              )}

              <div className="mt-2 rounded-lg px-3 py-2">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-ink-faint">{user.email}</p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-sunken"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </aside>

        <main id="contenu" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
