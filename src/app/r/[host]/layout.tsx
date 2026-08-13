import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { getTemplate } from '@/lib/templates/registry';
import { CartProvider } from '@/components/site/cart-context';
import { SiteChrome } from '@/components/site/chrome';
import { ServiceWorkerRegistration } from '@/components/site/service-worker';

type Props = {
  params: Promise<{ host: string }>;
  children: React.ReactNode;
};

/**
 * Métadonnées du site public.
 *
 * Chaque restaurant produit ses propres balises : titre, description, image de
 * partage et favicon. C'est ce qui rend chaque site indexable pour lui-même
 * plutôt que comme une page de Magya.
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
    // Le site du restaurant ne doit pas hériter du template de titre de Magya.
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

  return (
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
        }}
        host={host}
        templateKey={template.key}
      >
        {children}
      </SiteChrome>
      <ServiceWorkerRegistration scope={`/r/${host}/`} />
    </CartProvider>
  );
}
