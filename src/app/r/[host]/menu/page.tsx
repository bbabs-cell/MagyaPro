import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { loadPublicMenu, resolvePublicRestaurant } from '@/lib/site/resolve';
import { templateRenderer } from '@/components/site/templates';
import { PageViewTracker } from '@/components/site/page-view-tracker';
import { CategoryNav } from '@/components/site/category-nav';
import { getServerDictionary } from '@/lib/i18n/server';
import { localize, localizeNullable } from '@/lib/i18n/content';

type Props = { params: Promise<{ host: string }> };

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Découvrez notre carte et commandez en ligne.',
};

export default async function MenuPage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const categories = await loadPublicMenu(restaurant.id);
  const { Menu } = templateRenderer(restaurant.templateKey);
  const base = `/r/${host}`;
  const { locale, dict } = await getServerDictionary();

  const menuData = categories.map((category) => ({
    id: category.id,
    name: localize(category.name, { en: category.nameEn, ar: category.nameAr }, locale),
    description: localizeNullable(
      category.description,
      { en: category.descriptionEn, ar: category.descriptionAr },
      locale,
    ),
    products: category.products.map((product) => ({
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
      hasOptions: product.variants.length > 0 || product.optionGroups.length > 0,
    })),
  }));

  return (
    <>
      <PageViewTracker restaurantId={restaurant.id} path="/menu" />

      <div className="container-page py-8 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {dict.menuPage.title}
        </h1>

        {menuData.length === 0 ? (
          <p className="mt-6 text-ink-muted">{dict.menuPage.preparing}</p>
        ) : (
          <>
            <CategoryNav
              categories={menuData.map((category) => ({
                id: category.id,
                name: category.name,
              }))}
            />
            <div className="mt-8">
              <Menu categories={menuData} currency={restaurant.currency} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
