'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from '@/components/ui';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AdminLogoutButton } from '@/components/admin/logout-button';

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

const LINKS: Array<{ href: string; label: string; exact?: boolean; icon: React.ReactElement }> = [
  {
    href: '/admin',
    label: "Vue d'ensemble",
    exact: true,
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/admin/restaurants',
    label: 'Restaurants',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 10 5.5 4h13L20 10" />
        <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
        <path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    href: '/admin/boutiques',
    label: 'Boutiques',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 8l9-5 9 5-9 5-9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
    ),
  },
  {
    href: '/admin/utilisateurs',
    label: 'Utilisateurs',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17.5" cy="9" r="2.4" />
        <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
      </svg>
    ),
  },
  {
    href: '/admin/plans',
    label: 'Plans',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="M3 13l9 5 9-5" />
      </svg>
    ),
  },
  {
    href: '/admin/notifications',
    label: 'Notifications',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    href: '/admin/abonnements',
    label: 'Abonnements',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    ),
  },
  {
    href: '/admin/boutique-abonnements',
    label: 'Abonnements Boutique',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
        <path d="M17 3l2 2-2 2" />
      </svg>
    ),
  },
  {
    href: '/admin/consolide',
    label: 'Vue consolidée',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 20V10" />
        <path d="M9 20V6" />
        <path d="M14 20v-9" />
        <path d="M19 20V4" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 20V10" />
        <path d="M12 20V4" />
        <path d="M20 20v-7" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics-boutique',
    label: 'Analytics Boutique',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 20V10" />
        <path d="M12 20V4" />
        <path d="M20 20v-7" />
        <path d="M17 3l2 2-2 2" />
      </svg>
    ),
  },
  {
    href: '/admin/annonces',
    label: 'Annonces',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2l-1.5-5H10l9 4V6l-9 4H5a2 2 0 0 0-2 2Z" />
      </svg>
    ),
  },
  {
    href: '/admin/templates',
    label: 'Templates',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    href: '/admin/images',
    label: 'Images',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
      </svg>
    ),
  },
  {
    href: '/admin/journal',
    label: 'Journal',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
];

/**
 * Regroupement de la navigation.
 *
 * Les quatorze entrées étaient à plat, dans un ordre qui ne racontait rien.
 * Un premier regroupement les avait rangées par question — qu'est-ce qui se
 * passe, qui sont mes clients, combien ça rapporte — mais ce découpage
 * **éparpillait chaque produit sur trois sections** : répondre à « comment va
 * la Boutique ? » demandait de visiter Clients, puis Revenus, puis
 * Statistiques.
 *
 * Le §23-27 demande deux univers de premier niveau, et c'est effectivement la
 * bonne unité : le Super Admin pense par produit, pas par type de question.
 *
 * Restent en dehors des deux univers ce qui est réellement commun — la vue
 * d'ensemble et la vue consolidée, qui comparent les deux ; les utilisateurs,
 * qui peuvent appartenir aux deux ; les plans, qui portent déjà leur propre
 * onglet Restaurant/Boutique ; et les réglages de la plateforme elle-même.
 *
 * Une fois l'entrée placée sous « Restaurant » ou « Boutique », son libellé
 * n'a plus à répéter le produit : `label` sert précisément à l'alléger.
 *
 * Les icônes et les routes restent définies dans `LINKS` : cette structure ne
 * fait que les ordonner.
 */
const SECTIONS: Array<{ title: string; items: Array<{ href: string; label?: string }> }> = [
  {
    title: 'Plateforme',
    items: [
      { href: '/admin' },
      { href: '/admin/consolide', label: 'Vue consolidée' },
      { href: '/admin/journal' },
    ],
  },
  {
    title: 'Restaurant',
    items: [
      { href: '/admin/restaurants', label: 'Comptes' },
      { href: '/admin/abonnements', label: 'Abonnements' },
      // « Analytics » était le seul anglicisme de la navigation ; le reste du
      // produit dit « Statistiques » aux commerçants.
      { href: '/admin/analytics', label: 'Statistiques' },
      { href: '/admin/templates' },
    ],
  },
  {
    title: 'Boutique',
    items: [
      { href: '/admin/boutiques', label: 'Comptes' },
      { href: '/admin/boutique-abonnements', label: 'Abonnements' },
      { href: '/admin/analytics-boutique', label: 'Statistiques' },
    ],
  },
  {
    title: 'Commun',
    items: [
      { href: '/admin/utilisateurs' },
      { href: '/admin/plans' },
      { href: '/admin/annonces' },
      { href: '/admin/notifications' },
      { href: '/admin/images' },
    ],
  },
];

const LINK_BY_HREF = new Map(LINKS.map((link) => [link.href, link]));

export function AdminSidebar({
  logoUrl,
  userEmail,
  theme,
  onToggleTheme,
  unreadNotifications = 0,
}: {
  logoUrl: string | null;
  userEmail: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  /** Notifications de plateforme non lues — pastille sur l'entrée dédiée. */
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(link: (typeof LINKS)[number]) {
    return link.exact ? pathname === link.href : pathname.startsWith(link.href);
  }

  const navigation = (
    <nav aria-label="Navigation de l'administration" className="space-y-4">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          {/* Un simple intertitre plutôt qu'un menu repliable : un dépliage
              ajouterait un clic avant chaque navigation. L'espacement est
              serré à dessein — quinze entrées et quatre intertitres doivent
              tenir dans la hauteur d'un écran d'ordinateur portable. */}
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const link = LINK_BY_HREF.get(item.href);
              if (!link) return null;
              const active = isActive(link);
              // Un libellé raccourci ne se comprend que sous son intertitre —
              // et un intertitre visuel n'est pas lu dans une liste de liens.
              // « Comptes », « Abonnements » et « Statistiques » y
              // apparaîtraient deux ou trois fois, sans rien pour les
              // distinguer. Le nom accessible reprend donc l'univers, en
              // gardant le texte visible tel quel.
              const visible = item.label ?? link.label;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-label={item.label ? `${section.title} — ${item.label}` : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <span className="shrink-0">{link.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{visible}</span>
                  {link.href === '/admin/notifications' && unreadNotifications > 0 && (
                    <span className="shrink-0 rounded-full bg-[#ff5e2e] px-1.5 py-0.5 text-xs font-semibold text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/20 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu-mobile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15"
          >
            <span className="sr-only">{menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <Logo src={logoUrl} showText={false} className="h-7 w-7" />
            <span className="text-sm font-semibold">Administration</span>
          </Link>
          <ThemeToggle
            theme={theme}
            onToggle={onToggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:text-white"
          />
        </div>
        {/* Hauteur bornée puis défilement : le menu s'ouvre dans un en-tête
            épinglé, donc sans cette borne ses dernières entrées sortaient sous
            le bas de l'écran, hors d'atteinte. */}
        {menuOpen && (
          <div
            id="admin-menu-mobile"
            className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-white/10 p-4"
          >
            {navigation}
            <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
              <Link
                href="/dashboard"
                className="block rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
              >
                Mon restaurant
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        )}
      </header>

      {/* La colonne entière défile d'un bloc.
          Auparavant l'en-tête et le pied étaient épinglés et seule la
          navigation défilait au milieu : sur un écran d'ordinateur portable,
          ces deux blocs réservaient près de deux cents pixels et ne laissaient
          pas la place aux quinze entrées. Le cadre intérieur tranchait alors
          les intertitres en pleine hauteur de lettre, sans rien indiquer de ce
          qui restait au-dessus ou en dessous. */}
      <aside className="relative hidden w-64 shrink-0 bg-black/20 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="flex min-h-full flex-col p-4">
          <div className="shrink-0 px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <Link href="/admin" className="flex items-center gap-2">
                <Logo src={logoUrl} className="h-8 w-8" />
              </Link>
              <ThemeToggle
                theme={theme}
                onToggle={onToggleTheme}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:text-white"
              />
            </div>
            <p className="mt-4 truncate text-xs text-white/40">{userEmail}</p>
          </div>

          <div className="mt-5 flex-1">{navigation}</div>

          <div className="mt-5 shrink-0 space-y-1 border-t border-white/10 pt-4">
            <Link
              href="/dashboard"
              className="block rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              Mon restaurant
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
