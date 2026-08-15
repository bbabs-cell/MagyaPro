'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/components/site/cart-context';
import { useI18n } from '@/components/site/i18n-provider';
import { LanguageSwitcher } from '@/components/site/language-switcher';
import { dirFor } from '@/lib/i18n/locales';
import { cx } from '@/components/ui';

/**
 * Enveloppe commune à tous les templates : identité visuelle du restaurant,
 * navigation et accès au panier.
 *
 * Les couleurs et la police du restaurant sont injectées en variables CSS.
 * Elles proviennent de champs validés (`#RRGGBB`, liste fermée de polices), ce
 * qui interdit d'y glisser du CSS arbitraire.
 */

const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  Poppins: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  'DM Sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  'Space Grotesk': "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  'Playfair Display': "'Playfair Display', ui-serif, Georgia, serif",
};

/**
 * `ink` et `surface` sont normalement des couleurs fixes (voir
 * `tailwind.config.ts`) : les redéfinir ici en variables CSS, uniquement sur
 * les sites publics, fait basculer tous les templates en mode sombre d'un
 * coup — aucun n'a besoin de connaître l'existence de ce thème.
 */
const DARK_THEME_VARS = {
  '--surface': '#131417',
  '--surface-sunken': '#1c1e22',
  '--surface-border': '#2c2f34',
  '--ink': '#f2f3f5',
  '--ink-muted': '#a7adb6',
  '--ink-faint': '#767c86',
} as const;

const THEME_STORAGE_KEY = 'magyapro:theme';

export function SiteChrome({
  restaurant,
  host,
  templateKey,
  children,
}: {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    isDemo: boolean;
    orderingEnabled: boolean;
    reservationsEnabled: boolean;
  };
  host: string;
  templateKey: string;
  children: React.ReactNode;
}) {
  const { itemCount } = useCart();
  const pathname = usePathname();
  const { locale, dict } = useI18n();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Lu après le premier rendu, jamais pendant : le HTML servi par le serveur
  // ne connaît pas la préférence du navigateur, donc un premier rendu client
  // qui en tiendrait compte ne correspondrait pas au HTML reçu (avertissement
  // d'hydratation React).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
        return;
      }
    } catch {
      // Stockage indisponible (navigation privée) : on retombe sur la
      // préférence système ci-dessous.
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Le thème reste actif pour la session en cours même sans stockage.
      }
      return next;
    });
  }

  // Les liens doivent rester valides que la page soit servie depuis un
  // sous-domaine (chemin `/menu`) ou depuis `/r/<slug>/menu` en aperçu.
  const base = pathname.startsWith(`/r/${host}`) ? `/r/${host}` : '';

  const nav = [
    { href: base || '/', label: dict.nav.home },
    { href: `${base}/menu`, label: dict.nav.menu },
    ...(restaurant.reservationsEnabled
      ? [{ href: `${base}/reservation`, label: dict.nav.reserve }]
      : []),
    { href: `${base}/infos`, label: dict.nav.info },
  ];

  return (
    <div
      dir={dirFor(locale)}
      className="flex min-h-screen flex-col bg-surface text-ink"
      data-template={templateKey}
      style={
        {
          '--brand': restaurant.primaryColor,
          '--brand-ink': '#ffffff',
          '--font-sans': FONT_STACKS[restaurant.fontFamily] ?? FONT_STACKS.Inter,
          // Police des titres : distincte du choix de police du restaurant,
          // pour que les templates qui misent sur un contraste serif/sans
          // (`traditional`, `elegant`, `african-premium`) gardent cet effet
          // quelle que soit la police de corps de texte choisie.
          '--font-display': FONT_STACKS['Playfair Display'],
          ...(theme === 'dark' ? DARK_THEME_VARS : {}),
        } as React.CSSProperties
      }
    >
      {restaurant.isDemo && (
        <p className="bg-ink px-4 py-2 text-center text-xs text-surface">
          Restaurant de démonstration — les commandes passées ici sont fictives.
        </p>
      )}

      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href={base || '/'} className="flex min-w-0 items-center gap-2.5">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo de tenant, hôte arbitraire
              <img
                src={restaurant.logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate font-semibold tracking-tight">
              {restaurant.name}
            </span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm sm:flex"
            aria-label="Navigation du site"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cx(
                  'transition-colors hover:text-ink',
                  pathname === item.href ? 'font-medium text-ink' : 'text-ink-muted',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <LanguageSwitcher />
            {restaurant.orderingEnabled && (
              <Link
                href={`${base}/panier`}
                className="relative inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {dict.nav.cart}
                {itemCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs">
                    {itemCount}
                  </span>
                )}
                <span className="sr-only">
                  {itemCount === 0 ? dict.cart.empty : dict.cart.items(itemCount)}
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Navigation secondaire mobile : la barre principale ne peut pas
            accueillir les liens sans devenir illisible sur petit écran. */}
        <nav
          className="flex items-center gap-5 overflow-x-auto border-t border-surface-border px-4 py-2 text-sm sm:hidden"
          aria-label="Navigation du site (mobile)"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cx(
                'whitespace-nowrap',
                pathname === item.href ? 'font-medium text-ink' : 'text-ink-muted',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-surface-border bg-surface-sunken">
        <div className="container-page flex flex-col gap-3 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {restaurant.name}
          </p>
          <p className="text-xs text-ink-faint">
            {dict.footer.poweredBy}{' '}
            <a
              href="/"
              className="underline underline-offset-4 hover:text-ink"
              target="_blank"
              rel="noopener"
            >
              Magyapro
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: 'light' | 'dark';
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border text-ink-muted transition-colors hover:text-ink"
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 13a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 9a1 1 0 0 1 0 2H2a1 1 0 1 1 0-2h1Zm15 0a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1ZM5.05 4.636a1 1 0 0 1 1.415 0l.707.707a1 1 0 1 1-1.415 1.415l-.707-.707a1 1 0 0 1 0-1.415Zm9.193 9.193a1 1 0 0 1 1.415 0l.707.707a1 1 0 1 1-1.415 1.415l-.707-.707a1 1 0 0 1 0-1.415ZM14.95 4.636a1 1 0 0 1 0 1.415l-.707.707A1 1 0 1 1 12.828 5.34l.707-.707a1 1 0 0 1 1.415 0ZM5.757 13.828a1 1 0 0 1 0 1.415l-.707.707A1 1 0 1 1 3.636 14.535l.707-.707a1 1 0 0 1 1.415 0ZM10 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M17.293 13.293a8 8 0 0 1-10.586-10.586 8.001 8.001 0 1 0 10.586 10.586Z" />
        </svg>
      )}
    </button>
  );
}
