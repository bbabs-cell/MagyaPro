import { notFound } from 'next/navigation';
import Script from 'next/script';
import type { Metadata } from 'next';

import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { getTemplate } from '@/lib/templates/registry';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { resolveLocale } from '@/lib/i18n/server';
import { CartProvider } from '@/components/site/cart-context';
import { SiteChrome } from '@/components/site/chrome';
import { I18nProvider } from '@/components/site/i18n-provider';
import { ServiceWorkerRegistration } from '@/components/site/service-worker';

type Props = {
  params: Promise<{ host: string }>;
  children: React.ReactNode;
};

/**
 * Poids Google Fonts à charger pour chaque police proposée dans les
 * réglages d'apparence (`appearance-form.tsx`, liste fermée `FONTS`).
 *
 * Sans ce chargement, choisir « Playfair Display » ou « Space Grotesk » ne
 * changeait rien à l'affichage : la variable CSS pointait vers une police
 * jamais téléchargée, silencieusement remplacée par le système.
 */
const GOOGLE_FONT_FAMILIES: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700',
  Poppins: 'Poppins:wght@300;400;500;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@500;600;700',
};

function googleFontsHref(bodyFont: string): string {
  // Playfair Display est toujours chargée : c'est la police des titres
  // (`--font-display`), commune à tous les templates qui l'utilisent.
  const families = new Set<string>([GOOGLE_FONT_FAMILIES['Playfair Display']!]);
  const body = GOOGLE_FONT_FAMILIES[bodyFont];
  if (body) families.add(body);

  const query = [...families].map((family) => `family=${family}`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/**
 * Métadonnées du site public.
 *
 * Chaque restaurant produit ses propres balises : titre, description, image de
 * partage et favicon. C'est ce qui rend chaque site indexable pour lui-même
 * plutôt que comme une page de Magyapro.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);

  if (!restaurant) {
    return { title: 'Restaurant introuvable' };
  }

  const title = restaurant.seoTitle || restaurant.name;
  const description =
    restaurant.seoDescription ||
    restaurant.description ||
    `Découvrez le menu de ${restaurant.name} et commandez en ligne.`;
  const image = restaurant.seoImageUrl || restaurant.coverUrl || undefined;

  return {
    title: { default: title, template: `%s — ${restaurant.name}` },
    description,
    // Le site du restaurant ne doit pas hériter du template de titre de Magyapro.
    applicationName: restaurant.name,
    manifest: `/r/${host}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: restaurant.name, statusBarStyle: 'default' },
    icons: restaurant.faviconUrl ? { icon: restaurant.faviconUrl } : undefined,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: restaurant.name,
      locale: 'fr_FR',
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: restaurant.isDemo
      ? // Les restaurants de démonstration ne doivent pas polluer l'index.
        { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function PublicSiteLayout({ params, children }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);

  if (!restaurant) notFound();

  const template = getTemplate(restaurant.templateKey);
  const entitlements = await getEntitlements(restaurant.id);
  const locale = await resolveLocale();

  return (
    <I18nProvider locale={locale}>
      {/* Rendu n'importe où dans l'arbre, un `<link>` de Server Component est
          remonté par Next.js dans le `<head>` du document. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={googleFontsHref(restaurant.fontFamily)} />

      {/* Suivi propre au restaurant — ses identifiants, jamais ceux de
          Magyapro. Absent tant qu'il n'en a configuré aucun. */}
      {restaurant.settings?.googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${restaurant.settings.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${restaurant.settings.googleAnalyticsId}');`}
          </Script>
        </>
      )}
      {restaurant.settings?.metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${restaurant.settings.metaPixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}

      <CartProvider restaurantId={restaurant.id} currency={restaurant.currency}>
        <SiteChrome
          restaurant={{
            id: restaurant.id,
            slug: restaurant.slug,
            name: restaurant.name,
            logoUrl: restaurant.logoUrl,
            primaryColor: restaurant.primaryColor,
            secondaryColor: restaurant.secondaryColor,
            fontFamily: restaurant.fontFamily,
            isDemo: restaurant.isDemo,
            orderingEnabled: restaurant.settings?.orderingEnabled ?? true,
            reservationsEnabled: hasFeature(entitlements, FEATURES.RESERVATIONS),
          }}
          host={host}
          templateKey={template.key}
        >
          {children}
        </SiteChrome>
        <ServiceWorkerRegistration scope={`/r/${host}/`} />
      </CartProvider>
    </I18nProvider>
  );
}
