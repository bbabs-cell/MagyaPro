'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { cx } from '@/components/ui';
import { Logo } from '@/components/ui/logo';

/**
 * Ossature du tableau de bord MagyaPro Boutique — même structure visuelle
 * que celle de Restaurant (barre latérale à sections, icônes, dégradé),
 * volontairement recopiée pour que l'identité de la plateforme reste
 * cohérente d'un produit à l'autre. Pas de filtrage par permission dans
 * cette première version (toutes les rubriques existantes sont accessibles
 * à toute l'équipe) — Boutique n'a pas encore la granularité de rôles
 * différenciés que Restaurant applique à sa propre navigation.
 */

type NavItem = { href: string; label: string; exact?: boolean };

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
  '/boutique/dashboard/statistiques': (
    <svg {...ICON_PROPS}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
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
};

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Pilotage',
    items: [
      { href: '/boutique/dashboard', label: "Vue d'ensemble", exact: true },
      { href: '/boutique/dashboard/caisse', label: 'Caisse' },
      { href: '/boutique/dashboard/ventes', label: 'Ventes' },
      { href: '/boutique/dashboard/statistiques', label: 'Statistiques' },
    ],
  },
  {
    title: 'Boutique',
    items: [
      { href: '/boutique/dashboard/produits', label: 'Produits' },
      { href: '/boutique/dashboard/achats', label: 'Achats' },
      { href: '/boutique/dashboard/lots', label: 'Lots' },
      { href: '/boutique/dashboard/clients', label: 'Clients' },
    ],
  },
  {
    title: 'Finances',
    items: [
      { href: '/boutique/dashboard/depenses', label: 'Dépenses' },
      { href: '/boutique/dashboard/promotions', label: 'Promotions' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { href: '/boutique/dashboard/equipe', label: 'Équipe' },
      { href: '/boutique/dashboard/abonnement', label: 'Abonnement' },
    ],
  },
];

export function DashboardShell({
  platformLogoUrl,
  storeName,
  storeStatus,
  userName,
  userEmail,
  isSupportAccess = false,
  children,
}: {
  platformLogoUrl: string | null;
  storeName: string;
  storeStatus?: string;
  userName: string;
  userEmail: string;
  isSupportAccess?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleEndSupport() {
    await api.post('/api/admin/boutique-support-access/fin');
    router.replace('/admin');
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
      {NAV_SECTIONS.map((section) => (
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

      {storeStatus === 'SUSPENDED' && (
        <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm text-white">
          Cette boutique est suspendue : son site public est hors ligne et les
          modifications sont bloquées.
        </div>
      )}

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

      {/* Menu mobile : recouvrement plein écran fixe (pas un dépliant qui
          pousse le contenu) — évite l'état confus où le menu semble prendre
          la page sans qu'on sache où se trouve le reste du contenu. */}
      {menuOpen && (
        <div
          id="menu-mobile-boutique"
          className="fixed inset-0 z-40 overflow-y-auto bg-navy p-4 text-white lg:hidden"
        >
          <div className="flex h-14 items-center justify-between">
            <span className="truncate px-1 font-medium text-white">{storeName}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white"
            >
              <span className="sr-only">Fermer le menu</span>
              <span aria-hidden="true" className="text-lg leading-none">✕</span>
            </button>
          </div>
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

      <div className="lg:flex">
        <aside className="relative hidden w-64 shrink-0 overflow-hidden bg-navy text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -top-16 hidden h-64 w-64 rounded-full bg-[#ff5e2e] opacity-[0.08] blur-[100px] lg:block"
          />
          <div className="relative flex h-full flex-col p-4">
            <Link href="/boutique/dashboard" className="flex items-center gap-2 px-2 py-2">
              <Logo src={platformLogoUrl} />
            </Link>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="truncate text-sm font-medium">{storeName}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">MagyaPro Boutique</p>
            </div>

            <div className="mt-6 flex-1">{navigation}</div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a4d] to-[#ff5e2e] text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{userName}</span>
                  <span className="block truncate text-xs text-white/40">{userEmail}</span>
                </span>
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
