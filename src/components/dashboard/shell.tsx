'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { Badge, cx } from '@/components/ui';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AlertWatcher } from '@/components/dashboard/alert-watcher';
import { AnnouncementBanner } from '@/components/dashboard/announcement-banner';
import type { Permission } from '@/lib/rbac';

/**
 * Mêmes variables que le site public (`chrome.tsx`) : le thème dark premium
 * est la valeur par défaut de `ink`/`surface` (voir `tailwind.config.ts`),
 * appliquée sans override. Le thème clair, optionnel, redéfinit ces
 * variables ici — un ivoire teinté, jamais du blanc pur. La barre latérale
 * reste `bg-navy`, déjà sombre par défaut dans les deux thèmes.
 */
const LIGHT_THEME_VARS = {
  '--surface': '#faf8f4',
  '--surface-sunken': '#f1ede4',
  '--surface-border': '#e3ddd0',
  '--ink': '#221f1a',
  '--ink-muted': '#6b6459',
  '--ink-faint': '#948c7e',
} as const;

const DASHBOARD_THEME_STORAGE_KEY = 'magyapro:dashboard-theme';

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

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

/** Icônes de la navigation — un trait simple par rubrique, cohérent avec les autres icônes de la plateforme. */
const NAV_ICONS: Record<string, React.ReactElement> = {
  '/dashboard': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  '/dashboard/alertes': (
    <svg {...ICON_PROPS}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  '/dashboard/commandes': (
    <svg {...ICON_PROPS}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  '/dashboard/cuisine': (
    <svg {...ICON_PROPS}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  ),
  '/dashboard/livraisons': (
    <svg {...ICON_PROPS}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </svg>
  ),
  '/dashboard/reservations': (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3M16 3v3" />
    </svg>
  ),
  '/dashboard/clients': (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
  '/dashboard/statistiques': (
    <svg {...ICON_PROPS}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  ),
  '/dashboard/finances': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.6" />
    </svg>
  ),
  '/dashboard/menu': (
    <svg {...ICON_PROPS}>
      <path d="M5 3v18M5 3c3 0 3 4 0 4M19 3v18" />
    </svg>
  ),
  '/dashboard/photos': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M8 6l1.5-2h5L16 6" />
    </svg>
  ),
  '/dashboard/galerie': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </svg>
  ),
  '/dashboard/salle': (
    <svg {...ICON_PROPS}>
      <rect x="4" y="9" width="16" height="7" rx="1.5" />
      <path d="M4 16v3M20 16v3M4 9V6M20 9V6" />
    </svg>
  ),
  '/dashboard/apparence': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  '/dashboard/livraison': (
    <svg {...ICON_PROPS}>
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 12v5h5" />
    </svg>
  ),
  '/dashboard/promotions': (
    <svg {...ICON_PROPS}>
      <path d="M20 12 12.5 19.5a2 2 0 0 1-2.8 0L4 13.8a2 2 0 0 1 0-2.8L11.5 3.5H18a2 2 0 0 1 2 2V12Z" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  '/dashboard/fidelite': (
    <svg {...ICON_PROPS}>
      <path d="M12 20s-7-4.35-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.65-9.5 9-9.5 9Z" />
    </svg>
  ),
  '/dashboard/avis': (
    <svg {...ICON_PROPS}>
      <path d="M12 3.5l2.5 5.5 6 .7-4.5 4 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.5-4 6-.7Z" />
    </svg>
  ),
  '/dashboard/parametres': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  '/dashboard/equipe': (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M14.5 20a4.5 4.5 0 0 1 7-3.6" />
    </svg>
  ),
  '/dashboard/journal': (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  '/dashboard/abonnement': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  ),
  '/dashboard/aide': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
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
      { href: '/dashboard/finances', label: 'Finances', permission: 'finances:manage' },
    ],
  },
  {
    title: 'Restaurant',
    items: [
      { href: '/dashboard/menu', label: 'Menu', permission: 'menu:view' },
      { href: '/dashboard/photos', label: 'Atelier photo', permission: 'menu:manage' },
      { href: '/dashboard/galerie', label: 'Galerie', permission: 'restaurant:update' },
      { href: '/dashboard/salle', label: 'Salle', permission: 'tables:view' },
      { href: '/dashboard/apparence', label: 'Apparence', permission: 'restaurant:update' },
      { href: '/dashboard/livraison', label: 'Livraison', permission: 'delivery:manage' },
      { href: '/dashboard/promotions', label: 'Promotions', permission: 'promotions:manage' },
      { href: '/dashboard/fidelite', label: 'Fidélité', permission: 'loyalty:manage' },
      { href: '/dashboard/avis', label: 'Avis', permission: 'reviews:moderate' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { href: '/dashboard/parametres', label: 'Réglages', permission: 'settings:manage' },
      { href: '/dashboard/equipe', label: 'Équipe', permission: 'team:view' },
      { href: '/dashboard/journal', label: 'Journal', permission: 'audit:view' },
      { href: '/dashboard/abonnement', label: 'Abonnement', permission: 'subscription:view' },
      { href: '/dashboard/aide', label: "Centre d'aide" },
    ],
  },
];

export function DashboardShell({
  platformLogoUrl,
  role,
  user,
  restaurant,
  memberships,
  permissions,
  unreadCount,
  alertCount,
  subscription,
  isSupportAccess,
  announcements,
  children,
}: {
  platformLogoUrl: string | null;
  /** `null` en accès support (Super Admin) : traité comme un membre normal. */
  role: 'OWNER' | 'ADMIN' | 'EMPLOYEE' | 'COURIER' | null;
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
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
  }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // Le HTML servi par le serveur est déjà en thème sombre (valeurs par
  // défaut de `tailwind.config.ts`) : l'état initial correspond à ce rendu,
  // pas de préférence système à deviner ni d'avertissement d'hydratation.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    } catch {
      // Stockage indisponible (navigation privée) : le thème par défaut reste actif.
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, next);
      } catch {
        // Le thème reste actif pour la session en cours même sans stockage.
      }
      return next;
    });
  }

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

  // Un livreur n'a qu'une seule permission (`deliveries:drive`) : lui montrer
  // la barre latérale complète n'aurait de sens que pour afficher des
  // rubriques auxquelles il ne peut pas accéder. Un espace à part, réduit à
  // l'essentiel, plutôt que la même coquille avec presque tout grisé.
  if (role === 'COURIER') {
    return (
      <div
        className="min-h-screen bg-surface-sunken"
        style={theme === 'light' ? (LIGHT_THEME_VARS as React.CSSProperties) : undefined}
      >
        <header className="sticky top-0 z-30 border-b border-surface-border bg-surface">
          <div className="container-page flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo src={platformLogoUrl} showText={false} className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{restaurant.name}</p>
                <p className="truncate text-xs text-ink-faint">Espace livreur — {user.name}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
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

        <main id="contenu" className="p-4 sm:p-6">
          <div className="mx-auto max-w-2xl">{children}</div>
        </main>
      </div>
    );
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
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-white/35">
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
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive(item)
                      ? 'bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <span className="shrink-0">{NAV_ICONS[item.href]}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.href === '/dashboard/commandes' && unreadCount > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                      {unreadCount}
                    </span>
                  )}
                  {item.href === '/dashboard/alertes' && alertCount > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
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
    <div
      className="min-h-screen bg-surface-sunken"
      style={theme === 'light' ? (LIGHT_THEME_VARS as React.CSSProperties) : undefined}
    >
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

      <AnnouncementBanner announcements={announcements} />

      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface lg:hidden">
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
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Link
              href={`/r/${restaurant.slug}`}
              className="text-sm text-ink-muted underline underline-offset-4"
            >
              Site
            </Link>
          </div>
        </div>
        {menuOpen && (
          <div id="menu-mobile" className="border-t border-white/10 bg-navy p-4 text-white">
            {navigation}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </header>

      <div className="lg:flex">
        <aside className="hidden w-64 shrink-0 bg-navy text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed hidden h-64 w-64 -translate-x-8 -translate-y-16 rounded-full bg-[#ff5e2e] opacity-[0.08] blur-[100px] lg:block"
          />
          <div className="relative flex h-full flex-col p-4">
            <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2">
              <Logo src={platformLogoUrl} />
            </Link>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="truncate text-sm font-medium">{restaurant.name}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">
                {restaurant.slug}
              </p>

              {/* Le sélecteur n'apparaît que s'il y a un choix à faire. */}
              {memberships.length > 1 && (
                <select
                  aria-label="Changer de restaurant"
                  value={restaurant.id}
                  onChange={(event) => switchRestaurant(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white"
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.id} className="text-ink">
                      {membership.name}
                    </option>
                  ))}
                </select>
              )}

              <Link
                href={`/r/${restaurant.slug}`}
                className="mt-2 block text-xs text-white/50 underline underline-offset-4 hover:text-white"
              >
                Voir le site public
              </Link>
            </div>

            <div className="mt-6 flex-1">{navigation}</div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <Link
                href="/dashboard/abonnement"
                className="block rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <p className="text-xs text-white/40">Abonnement</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm">
                  <span className={subscription.isActive ? 'font-medium text-[#ff9a4d]' : undefined}>
                    {subscription.planName}
                  </span>
                  {!subscription.isActive && <Badge tone="danger">Inactif</Badge>}
                </p>
              </Link>

              {user.isSuperAdmin && (
                <Link
                  href="/admin"
                  className="mt-1 block rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                >
                  Administration Magyapro
                </Link>
              )}

              <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a4d] to-[#ff5e2e] text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-white/40">{user.email}</span>
                </span>
                <ThemeToggle
                  theme={theme}
                  onToggle={toggleTheme}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white"
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
