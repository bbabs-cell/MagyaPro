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

export function AdminSidebar({
  logoUrl,
  userEmail,
  theme,
  onToggleTheme,
}: {
  logoUrl: string | null;
  userEmail: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(link: (typeof LINKS)[number]) {
    return link.exact ? pathname === link.href : pathname.startsWith(link.href);
  }

  const navigation = (
    <nav aria-label="Navigation de l'administration" className="space-y-0.5">
      {LINKS.map((link) => {
        const active = isActive(link);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] text-white shadow-sm'
                : 'text-white/60 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className="shrink-0">{link.icon}</span>
            <span className="truncate">{link.label}</span>
          </Link>
        );
      })}
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
        {menuOpen && (
          <div id="admin-menu-mobile" className="border-t border-white/10 p-4">
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

      <aside className="relative hidden w-64 shrink-0 bg-black/20 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <Link href="/admin" className="flex items-center gap-2">
              <Logo src={logoUrl} className="h-8 w-8" />
            </Link>
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:text-white"
            />
          </div>

          <p className="mt-4 truncate px-2 text-xs text-white/40">{userEmail}</p>

          <div className="mt-6 flex-1">{navigation}</div>

          <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
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
