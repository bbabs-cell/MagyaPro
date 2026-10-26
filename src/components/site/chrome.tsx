'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCart } from '@/components/site/cart-context';
import { useI18n } from '@/components/site/i18n-provider';
import { LanguageSwitcher } from '@/components/site/language-switcher';
import { dirFor } from '@/lib/i18n/locales';
import { siteFontStack, siteFontVariables } from '@/lib/site/fonts';
import { cx } from '@/components/ui';
import { CookieConsent } from '@/components/site/cookie-consent';
import { formatMoney } from '@/lib/money';

/**
 * Enveloppe commune à tous les templates : identité visuelle du restaurant,
 * navigation et accès au panier.
 *
 * Les couleurs et la police du restaurant sont injectées en variables CSS.
 * Elles proviennent de champs validés (`#RRGGBB`, liste fermée de polices), ce
 * qui interdit d'y glisser du CSS arbitraire.
 */


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
  const { itemCount, estimatedSubtotal, currency } = useCart();
  const pathname = usePathname();
  const { locale, dict } = useI18n();

  // Les liens doivent rester valides que la page soit servie depuis un
  // sous-domaine (chemin `/menu`) ou depuis `/r/<slug>/menu` en aperçu.
  const base = pathname.startsWith(`/r/${host}`) ? `/r/${host}` : '';

  // Pas sur le panier ni sur le suivi d'une commande : on y est déjà.
  const showCartBar =
    restaurant.orderingEnabled &&
    itemCount > 0 &&
    !pathname.endsWith('/panier') &&
    !pathname.includes('/commande/');

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
      // Les variables des cinq polices sont déclarées ici ; seule celle
      // effectivement appliquée est téléchargée par le navigateur.
      // `font-sans` (et non la seule redéfinition de `--font-sans` ci-dessous) :
      // une propriété personnalisée redéfinie sur un descendant ne change pas
      // la `font-family` déjà calculée sur `body` — ce nœud en héritait, donc
      // la police choisie par le restaurateur n'était jamais appliquée. Il
      // faut redemander ici la résolution de la variable.
      className={`${siteFontVariables} font-sans flex min-h-screen flex-col bg-surface text-ink`}
      data-template={templateKey}
      style={
        {
          '--brand': restaurant.primaryColor,
          // La braise foncée de la plateforme ne s'applique pas ici : le
          // restaurateur a choisi sa couleur, ses boutons la gardent telle quelle.
          '--brand-strong': restaurant.primaryColor,
          '--brand-text': restaurant.primaryColor,
          '--brand-ink': '#ffffff',
          '--font-sans': siteFontStack(restaurant.fontFamily),
          // Police des titres : distincte du choix de police du restaurant,
          // pour que les templates qui misent sur un contraste serif/sans
          // (`traditional`, `elegant`, `african-premium`) gardent cet effet
          // quelle que soit la police de corps de texte choisie.
          '--font-display': siteFontStack('Playfair Display'),
        } as React.CSSProperties
      }
    >
      {restaurant.isDemo && (
        <p className="bg-ink px-4 py-2 text-center text-xs text-surface">
          Restaurant de démonstration — les commandes passées ici sont fictives.
        </p>
      )}

      {/**
       * 30 % — volontairement très bas. Ce n'est pas un oubli, et ce n'est pas
       * la valeur qu'on met d'ordinaire sur un en-tête collant.
       *
       * Historique, pour qui voudrait la « corriger » : ces barres ont
       * longtemps paru entièrement transparentes, parce que les modificateurs
       * d'opacité du thème n'émettaient aucune règle. C'était un défaut, mais
       * le rendu qu'il produisait faisait l'identité visuelle du site, et il a
       * été demandé de le retrouver.
       *
       * Ce qui protège le texte ici n'est donc pas le fond, c'est **le flou**.
       * À 40 px, ce qui passe derrière devient une masse uniforme sans contour
       * lisible : le contraste du texte tient, alors même qu'on voit au
       * travers. La saturation compense le délavage que produit un flou aussi
       * large.
       *
       * Conséquence à connaître avant d'y toucher : baisser encore l'opacité
       * **sans** garder ce flou ramènerait le défaut d'origine — un titre
       * sombre passant sous la barre rendrait la navigation illisible.
       */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/30 backdrop-blur-2xl backdrop-saturate-150">
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
                  pathname === item.href ? 'font-semibold text-ink' : 'text-ink',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
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
                pathname === item.href ? 'font-semibold text-ink' : 'text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="contenu" className={cx('flex-1', showCartBar && 'pb-24 sm:pb-0')}>
        {children}
      </main>

      {/* Barre de commande collante, sur téléphone seulement : dès le premier
          article, le panier et son montant restent sous le pouce, où que l'on
          soit dans la page. Le bouton « Panier » de l'en-tête, lui, disparaît
          en haut de l'écran au premier défilement. */}
      {showCartBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden print:hidden">
          <Link
            href={`${base}/panier`}
            className="flex h-14 animate-slide-in-up items-center justify-between gap-3 rounded-2xl px-4 text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)] active:scale-[0.98]"
            style={{ backgroundColor: restaurant.primaryColor }}
          >
            <span className="flex items-center gap-3">
              <span
                key={itemCount}
                className="flex h-8 min-w-8 animate-pop items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold tabular-nums"
              >
                {itemCount}
              </span>
              <span className="font-semibold">{dict.templates.ctaViewCart}</span>
            </span>
            <span className="font-semibold tabular-nums">{formatMoney(estimatedSubtotal, currency)}</span>
          </Link>
        </div>
      )}

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
              MagyaPro
            </a>
          </p>
        </div>
      </footer>

      <CookieConsent />
    </div>
  );
}
