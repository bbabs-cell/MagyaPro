import Link from 'next/link';
import { notFound } from 'next/navigation';

import { loadPublicMenu, resolvePublicRestaurant } from '@/lib/site/resolve';
import { computeOpenState } from '@/lib/site/hours';
import { templateRenderer } from '@/components/site/templates';
import { PageViewTracker } from '@/components/site/page-view-tracker';
import { StructuredData } from '@/components/site/structured-data';
import { getServerDictionary } from '@/lib/i18n/server';
import { localize, localizeNullable } from '@/lib/i18n/content';

type Props = { params: Promise<{ host: string }> };

export default async function RestaurantHomePage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const categories = await loadPublicMenu(restaurant.id);
  const openState = computeOpenState(restaurant.openingHours, restaurant.timezone);
  const { Hero, Menu } = templateRenderer(restaurant.templateKey);

  const base = `/r/${host}`;
  const orderingEnabled = restaurant.settings?.orderingEnabled ?? true;
  const { locale, dict } = await getServerDictionary();

  // Aperçu de la carte sur l'accueil : les deux premières catégories suffisent
  // à donner envie, la page menu porte l'intégralité.
  const preview = categories.slice(0, 2).map((category) => ({
    id: category.id,
    name: localize(category.name, { en: category.nameEn, ar: category.nameAr }, locale),
    description: localizeNullable(
      category.description,
      { en: category.descriptionEn, ar: category.descriptionAr },
      locale,
    ),
    products: category.products.slice(0, 4).map((product) => ({
      id: product.id,
      slug: product.slug,
      name: localize(product.name, { en: product.nameEn, ar: product.nameAr }, locale),
      description: localizeNullable(
        product.description,
        { en: product.descriptionEn, ar: product.descriptionAr },
        locale,
      ),
      imageUrl: product.imageUrl,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      isAvailable: product.isAvailable,
      badge: product.badge,
      href: `${base}/plat/${product.slug}`,
    })),
  }));

  return (
    <>
      <PageViewTracker restaurantId={restaurant.id} path="/" />
      <StructuredData restaurant={restaurant} openState={openState} />

      <Hero
        data={{
          name: restaurant.name,
          description: restaurant.description,
          coverUrl: restaurant.coverUrl,
          logoUrl: restaurant.logoUrl,
          city: restaurant.city,
          primaryColor: restaurant.primaryColor,
          isOpenNow: openState.isOpen,
          openLabel: openState.label,
          menuHref: `${base}/menu`,
          orderingEnabled,
        }}
      />

      <div className="container-page py-14 sm:py-16">
        {preview.length === 0 ? (
          <p className="text-center text-ink-muted">{dict.menuPage.preparing}</p>
        ) : (
          <>
            <Menu categories={preview} currency={restaurant.currency} />
            <div className="mt-12 text-center">
              <Link
                href={`${base}/menu`}
                className="inline-flex h-12 items-center rounded-xl border border-surface-border px-6 font-medium hover:bg-surface-sunken"
              >
                {dict.menuPage.seeAll}
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
