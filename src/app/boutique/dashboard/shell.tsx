'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import type { StoreRole } from '@prisma/client';

import { api } from '@/lib/client/api';
import { cx } from '@/components/ui';
import { Logo } from '@/components/ui/logo';
import { StoreSwitcher } from '@/components/boutique/store-switcher';
import { AnnouncementBanner } from '@/components/dashboard/announcement-banner';
import { NotificationWatcher } from '@/components/account/notification-watcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useBoutiqueTheme } from '@/components/boutique/use-boutique-theme';

/**
 * Ossature du tableau de bord MagyaPro Boutique — même structure visuelle
 * que celle de Restaurant (barre latérale à sections, icônes, dégradé),
 * volontairement recopiée pour que l'identité de la plateforme reste
 * cohérente d'un produit à l'autre. Pas de filtrage par permission dans
 * cette première version (toutes les rubriques existantes sont accessibles
 * à toute l'équipe) — Boutique n'a pas encore la granularité de rôles
 * différenciés que Restaurant applique à sa propre navigation.
 */

type NavItem = { href: string; label: string; exact?: boolean; badge?: number };

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

const NAV_ICONS: Record<string, React.ReactElement> = {
  '/boutique/dashboard': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  '/boutique/dashboard/caisse': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.6" />
    </svg>
  ),
  '/boutique/dashboard/ventes': (
    <svg {...ICON_PROPS}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  '/boutique/dashboard/commandes': (
    <svg {...ICON_PROPS}>
      <rect x="4" y="7" width="16" height="14" rx="2" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  ),
  '/boutique/dashboard/rapports': (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  ),
  '/boutique/dashboard/statistiques': (
    <svg {...ICON_PROPS}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  ),
  '/boutique/dashboard/mouvements': (
    <svg {...ICON_PROPS}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  '/boutique/dashboard/analyses': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l6.4 4.2" />
    </svg>
  ),
  '/boutique/dashboard/produits': (
    <svg {...ICON_PROPS}>
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  ),
  '/boutique/dashboard/achats': (
    <svg {...ICON_PROPS}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  '/boutique/dashboard/lots': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  '/boutique/dashboard/clients': (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
  '/boutique/dashboard/equipe': (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M14.5 20a4.5 4.5 0 0 1 7-3.6" />
    </svg>
  ),
  '/boutique/dashboard/finances': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15.5c.5 1 1.5 1.5 3 1.5s3-1 3-2.2-1-1.8-3-2.3-3-1.1-3-2.3 1.5-2.2 3-2.2 2.5.5 3 1.5" />
      <path d="M12 6.5v11" />
    </svg>
  ),
  '/boutique/dashboard/depenses': (
    <svg {...ICON_PROPS}>
      <path d="M12 4v13" />
      <path d="M6 12l6 6 6-6" />
      <path d="M4 21h16" />
    </svg>
  ),
  '/boutique/dashboard/promotions': (
    <svg {...ICON_PROPS}>
      <path d="M20 12 12.5 19.5a2 2 0 0 1-2.8 0L4 13.8a2 2 0 0 1 0-2.8L11.5 3.5H18a2 2 0 0 1 2 2V12Z" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  '/boutique/dashboard/abonnement': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  ),
  '/boutique/dashboard/notifications': (
    <svg {...ICON_PROPS}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </svg>
  ),
  '/boutique/dashboard/toutes-boutiques': (
    <svg {...ICON_PROPS}>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M4 9h16" />
    </svg>
  ),
  '/boutique/dashboard/api-docs': (
    <svg {...ICON_PROPS}>
      <path d="M8 3 3 12l5 9" />
      <path d="M16 3l5 9-5 9" />
    </svg>
  ),
  '/boutique/dashboard/parametres': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  ),
  '/boutique/dashboard/securite': (
    <svg {...ICON_PROPS}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9.5 12l1.8 1.8 3.2-3.6" />
    </svg>
  ),
  '/boutique/dashboard/previsions': (
    <svg {...ICON_PROPS}>
      <path d="M4 6v13a1 1 0 0 0 1 1h15" />
      <path d="M7 9l4 4 3-3 5 6" />
    </svg>
  ),
  '/boutique/dashboard/aide': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function getNavSections(
  canViewAllStores: boolean,
  unreadNotifications: number,
  canManageApi: boolean,
  isDemoTour: boolean,
): Array<{ title: string; items: NavItem[] }> {
  return [
    {
      title: 'Pilotage',
      items: [
        { href: '/boutique/dashboard', label: "Vue d'ensemble", exact: true },
        { href: '/boutique/dashboard/caisse', label: 'Caisse' },
        { href: '/boutique/dashboard/ventes', label: 'Ventes' },
        { href: '/boutique/dashboard/commandes', label: 'Commandes en ligne' },
        {
          href: '/boutique/dashboard/notifications',
          label: 'Notifications',
          badge: unreadNotifications,
        },
        { href: '/boutique/dashboard/rapports', label: 'Rapports' },
        { href: '/boutique/dashboard/statistiques', label: 'Statistiques' },
        { href: '/boutique/dashboard/analyses', label: 'Analyses' },
        ...(canViewAllStores
          ? [{ href: '/boutique/dashboard/toutes-boutiques', label: 'Toutes les boutiques' }]
          : []),
      ],
    },
    {
      title: 'Boutique',
      items: [
        { href: '/boutique/dashboard/produits', label: 'Produits' },
        { href: '/boutique/dashboard/previsions', label: 'Prévisions' },
        { href: '/boutique/dashboard/mouvements', label: 'Mouvements' },
        { href: '/boutique/dashboard/apparence', label: 'Apparence' },
        { href: '/boutique/dashboard/achats', label: 'Achats' },
        { href: '/boutique/dashboard/lots', label: 'Lots' },
        { href: '/boutique/dashboard/clients', label: 'Clients' },
      ],
    },
    {
      title: 'Finances',
      items: [
        { href: '/boutique/dashboard/finances', label: 'Finances' },
        { href: '/boutique/dashboard/depenses', label: 'Dépenses' },
        { href: '/boutique/dashboard/promotions', label: 'Promotions' },
      ],
    },
    {
      title: 'Compte',
      items: [
        { href: '/boutique/dashboard/equipe', label: 'Équipe' },
        { href: '/boutique/dashboard/abonnement', label: 'Abonnement' },
        ...(canManageApi ? [{ href: '/boutique/dashboard/api-docs', label: 'API' }] : []),
        { href: '/boutique/dashboard/parametres', label: 'Réglages' },
        // Réglage personnel du compte connecté — sans objet pour une visite
        // guidée anonyme, et la page échouerait (elle exige une vraie session).
        ...(isDemoTour ? [] : [{ href: '/boutique/dashboard/securite', label: 'Sécurité' }]),
        { href: '/boutique/dashboard/aide', label: "Centre d'aide" },
      ],
    },
  ];
}

export function DashboardShell({
  platformLogoUrl,
  storeId,
  storeName,
  storeStatus,
  stores,
  unreadNotifications = 0,
  canManageApi = false,
  userName,
  userEmail,
  isSupportAccess = false,
  isDemoTour = false,
  announcements = [],
  children,
}: {
  platformLogoUrl: string | null;
  storeId: string;
  storeName: string;
  storeStatus?: string;
  /** Boutiques du compte connecté, pour le sélecteur — voir `listStoreMemberships`. */
  stores: Array<{ id: string; name: string; role: StoreRole }>;
  unreadNotifications?: number;
  canManageApi?: boolean;
  userName: string;
  userEmail: string;
  isSupportAccess?: boolean;
  /** Visite guidée anonyme d'une boutique de démonstration — voir `getDemoTourContext`. */
  isDemoTour?: boolean;
  announcements?: Array<{ id: string; title: string; body: string; severity: 'INFO' | 'WARNING' | 'CRITICAL' }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useBoutiqueTheme();
  const canViewAllStores =
    stores.length > 1 && stores.some((s) => s.role === 'OWNER' || s.role === 'ADMIN');
  const navSections = getNavSections(canViewAllStores, unreadNotifications, canManageApi, isDemoTour);

  async function handleEndSupport() {
    await api.post('/api/admin/boutique-support-access/fin');
    router.replace('/admin');
    router.refresh();
  }

  async function handleEndDemoTour() {
    await api.delete('/api/public/boutique/demo-tour');
    router.replace('/boutique');
    router.refresh();
  }

  // Empêche le défilement de la page derrière le menu plein écran — sans
  // ça, on peut faire défiler le contenu masqué en même temps que le menu.
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  function isActive(item: NavItem) {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.replace('/boutique/connexion');
    router.refresh();
  }

  const navigation = (
    <nav className="space-y-6" aria-label="Navigation du tableau de bord">
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-nav-muted/70">
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
                      ? 'bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] text-white shadow-elev1'
                      : 'text-nav-muted hover:bg-nav-raised hover:text-nav-ink',
                  )}
                >
                  <span className="shrink-0">{NAV_ICONS[item.href]}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {Boolean(item.badge) && (
                    <span className="shrink-0 rounded-full bg-[#ff5e2e] px-1.5 py-0.5 text-xs font-semibold text-white">
                      {item.badge}
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
    // `text-ink` réinitialise explicitement la couleur de texte : le layout
    // racine `/boutique` (pages avant connexion) pose un texte clair sur fond
    // sombre pour son propre thème, hérité sinon par tout élément d'ici qui
    // ne fixe pas sa couleur — ce qui rendait plusieurs textes du tableau de
    // bord (clair, ink/surface) quasi invisibles sur leur fond clair.
    <div className="min-h-screen bg-surface-sunken text-ink">
      {/* Aucun son en visite guidée : un visiteur anonyme n'a aucune raison
          d'être notifié de l'activité réelle de la boutique qu'il explore. */}
      {!isDemoTour && <NotificationWatcher endpoint="/api/boutique/notifications" />}

      {/* Bandeau d'accès support : impossible à manquer, pour que
          l'administrateur sache qu'il agit dans l'espace d'un client. */}
      {isSupportAccess && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Accès support actif sur « {storeName} ». Vos actions sont
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

      {isDemoTour && (
        <div className="bg-[#e0bd52] px-4 py-2 text-center text-sm font-medium text-[#1c1712]">
          Visite guidée de « {storeName} » — consultation uniquement, aucune vente ni
          modification n&apos;est enregistrée.{' '}
          <button type="button" onClick={handleEndDemoTour} className="underline underline-offset-2">
            Quitter la démonstration
          </button>
        </div>
      )}

      {storeStatus === 'SUSPENDED' && (
        <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm text-white">
          Cette boutique est suspendue : son site public est hors ligne et les
          modifications sont bloquées.
        </div>
      )}

      <AnnouncementBanner announcements={announcements} />

      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile-boutique"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border text-ink"
          >
            <span className="sr-only">Ouvrir le menu</span>
            <span aria-hidden="true" className="text-lg leading-none">☰</span>
          </button>
          <span className="truncate px-3 font-medium text-ink">{storeName}</span>
          <div className="w-10" />
        </div>
      </header>

      {/* Menu mobile : tiroir qui glisse depuis la gauche (largeur fixe, comme
          la barre latérale de bureau) plutôt qu'un recouvrement plein écran —
          le reste de la page reste visible, assombri, derrière. Toujours
          monté (jamais démonté) pour que la transition de glissement
          s'anime dans les deux sens ; seul `aria-hidden`/`pointer-events`
          empêche l'interaction quand il est fermé. */}
      <div
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
        className={cx(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden',
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        id="menu-mobile-boutique"
        aria-hidden={!menuOpen}
        className={cx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-nav p-4 text-nav-ink transition-transform duration-200 ease-out lg:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between">
          <span className="truncate px-1 font-medium text-nav-ink">{storeName}</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-nav-border text-nav-ink"
          >
            <span className="sr-only">Fermer le menu</span>
            <span aria-hidden="true" className="text-lg leading-none">✕</span>
          </button>
        </div>
        {navigation}
        <button
          type="button"
          onClick={isDemoTour ? handleEndDemoTour : handleLogout}
          className="mt-6 w-full rounded-lg px-3 py-2 text-left text-sm text-nav-muted transition-colors hover:bg-nav-raised hover:text-nav-ink"
        >
          {isDemoTour ? 'Quitter la démonstration' : 'Se déconnecter'}
        </button>
      </div>

      <div className="lg:flex">
        <aside className="relative hidden w-64 shrink-0 overflow-hidden bg-nav text-nav-ink lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -top-16 hidden h-64 w-64 rounded-full bg-[#ff5e2e] opacity-[0.08] blur-[100px] lg:block"
          />
          <div className="relative flex h-full flex-col p-4">
            <Link href="/boutique/dashboard" className="flex items-center gap-2 px-2 py-2">
              <Logo src={platformLogoUrl} />
            </Link>

            <StoreSwitcher currentStoreId={storeId} currentStoreName={storeName} stores={stores} />

            <div className="mt-6 flex-1">{navigation}</div>

            <div className="mt-6 border-t border-nav-border pt-4">
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a4d] to-[#ff5e2e] text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{userName}</span>
                  <span className="block truncate text-xs text-nav-muted/70">{userEmail}</span>
                </span>
                <ThemeToggle
                  theme={theme}
                  onToggle={toggleTheme}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nav-border text-nav-muted transition-colors hover:bg-nav-raised hover:text-nav-ink"
                />
              </div>

              <button
                type="button"
                onClick={isDemoTour ? handleEndDemoTour : handleLogout}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-nav-muted transition-colors hover:bg-nav-raised hover:text-nav-ink"
              >
                {isDemoTour ? 'Quitter la démonstration' : 'Se déconnecter'}
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
