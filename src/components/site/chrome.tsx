'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCart } from '@/components/site/cart-context';
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

  // Les liens doivent rester valides que la page soit servie depuis un
  // sous-domaine (chemin `/menu`) ou depuis `/r/<slug>/menu` en aperçu.
  const base = pathname.startsWith(`/r/${host}`) ? `/r/${host}` : '';

  const nav = [
    { href: base || '/', label: 'Accueil' },
    { href: `${base}/menu`, label: 'Menu' },
    ...(restaurant.reservationsEnabled
      ? [{ href: `${base}/reservation`, label: 'Réserver' }]
      : []),
    { href: `${base}/infos`, label: 'Informations' },
  ];

  return (
    <div
      className="flex min-h-screen flex-col bg-white"
      data-template={templateKey}
      style={
        {
          '--brand': restaurant.primaryColor,
          '--brand-ink': '#ffffff',
          '--font-sans': FONT_STACKS[restaurant.fontFamily] ?? FONT_STACKS.Inter,
        } as React.CSSProperties
      }
    >
      {restaurant.isDemo && (
        <p className="bg-ink px-4 py-2 text-center text-xs text-white">
          Restaurant de démonstration — les commandes passées ici sont fictives.
        </p>
      )}

      <header className="sticky top-0 z-40 border-b border-surface-border bg-white/95 backdrop-blur">
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

          {restaurant.orderingEnabled && (
            <Link
              href={`${base}/panier`}
              className="relative inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white"
              style={{ backgroundColor: restaurant.primaryColor }}
            >
              Panier
              {itemCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs">
                  {itemCount}
                </span>
              )}
              <span className="sr-only">
                {itemCount === 0
                  ? 'Panier vide'
                  : `${itemCount} article${itemCount > 1 ? 's' : ''} dans le panier`}
              </span>
            </Link>
          )}
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
            Propulsé par{' '}
            <a
              href="/"
              className="underline underline-offset-4 hover:text-ink"
              target="_blank"
              rel="noopener"
            >
              Magya
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
