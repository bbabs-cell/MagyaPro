import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';
import { DEFAULT_LOCALE, dirFor, isLocale } from '@/lib/i18n/locales';
import { CartProvider } from '@/components/site-store/cart-context';
import { CartLink } from '@/components/site-store/cart-link';
import { DemoTourButton } from '@/components/boutique/demo-tour-button';

/**
 * Poids Google Fonts à charger pour chaque police proposée dans les réglages
 * d'apparence (`appearance-form.tsx`) — même liste fermée que côté
 * Restaurant (`src/app/r/[host]/layout.tsx`), dupliquée ici plutôt que
 * partagée : les deux produits évoluent indépendamment.
 */
const GOOGLE_FONT_FAMILIES: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700',
  Poppins: 'Poppins:wght@300;400;500;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@500;600;700',
};

const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  Poppins: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  'DM Sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  'Space Grotesk': "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  'Playfair Display': "'Playfair Display', ui-serif, Georgia, serif",
};

function googleFontsHref(fontFamily: string): string {
  const family = GOOGLE_FONT_FAMILIES[fontFamily] ?? GOOGLE_FONT_FAMILIES.Inter!;
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
}

/**
 * Racine du site public d'une boutique, atteinte soit via
 * `boutique.magyapro.com/s/<slug>`, soit via un domaine personnalisé
 * vérifié (voir `StoreDomain` et le commentaire dans `src/middleware.ts`) —
 * `sitePathBase()` adapte les liens internes à ces deux cas. La mise en page
 * (choisie via `templateKey`, voir `src/components/site-store/templates`)
 * varie d'une boutique à l'autre, mais cette enveloppe commune (en-tête,
 * pied de page) reste neutre — les couleurs choisies par la boutique
 * (`--brand`) et sa police y sont injectées en variables CSS, jamais les
 * tokens `ink`/`surface`/`brand` réservés au dashboard (voir le commentaire
 * de `src/app/boutique/layout.tsx`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) return { title: 'Boutique introuvable' };

  return {
    title: store.name,
    description: store.description ?? `${store.name} sur MagyaPro Boutique.`,
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
    robots: store.isDemo ? { index: false, follow: false } : undefined,
    openGraph: {
      title: store.name,
      description: store.description ?? undefined,
      images: store.coverUrl ? [store.coverUrl] : store.logoUrl ? [store.logoUrl] : undefined,
    },
  };
}

export default async function StoreSiteLayout({
  params,
  children,
}: {
  params: Promise<{ host: string }>;
  children: React.ReactNode;
}) {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();
  const base = sitePathBase(host);
  const dict = getBoutiqueSiteDictionary(store.language);
  const locale = isLocale(store.language) ? store.language : DEFAULT_LOCALE;

  return (
    <CartProvider storeId={store.id}>
      {/* Rendu n'importe où dans l'arbre, un `<link>` de Server Component est
          remonté par Next.js dans le `<head>` du document. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={googleFontsHref(store.fontFamily)} />

      <div
        dir={dirFor(locale)}
        className="min-h-screen bg-white text-gray-900"
        style={
          {
            '--brand': store.primaryColor,
            '--brand-dark': store.secondaryColor,
            fontFamily: FONT_STACKS[store.fontFamily] ?? FONT_STACKS.Inter,
          } as React.CSSProperties
        }
      >
        {store.isDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gray-900 px-4 py-2 text-center text-xs text-white">
            <span>Boutique de démonstration — les commandes passées ici sont fictives.</span>
            <DemoTourButton slug={store.slug} className="underline underline-offset-2 hover:text-gray-300">
              Explorer le tableau de bord
            </DemoTourButton>
          </div>
        )}

        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href={base || '/'} className="flex items-center gap-2.5">
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo déposé par le tenant
                <img src={store.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-semibold tracking-tight">{store.name}</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href={`${base}/produits`} className="text-gray-600 hover:text-gray-900">
                {dict.catalog}
              </Link>
              <CartLink host={host} locale={store.language} />
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-16 border-t border-gray-200 py-8 text-center text-xs text-gray-400">
          <p>{store.name}</p>
          <p className="mt-1">
            {dict.poweredBy}{' '}
            <a href="https://magyapro.com" className="underline underline-offset-2">
              MagyaPro
            </a>
          </p>
        </footer>
      </div>
    </CartProvider>
  );
}
