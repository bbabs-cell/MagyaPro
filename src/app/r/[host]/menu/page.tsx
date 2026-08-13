import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { loadPublicMenu, resolvePublicRestaurant } from '@/lib/site/resolve';
import { templateRenderer } from '@/components/site/templates';
import { PageViewTracker } from '@/components/site/page-view-tracker';
import { CategoryNav } from '@/components/site/category-nav';

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

  const menuData = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    products: category.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
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
      <PageViewTracker restaurantId={restaurant.id} path="/menu" />

      <div className="container-page py-8 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Notre carte
        </h1>

        {menuData.length === 0 ? (
          <p className="mt-6 text-ink-muted">
            La carte est en cours de préparation. Revenez très bientôt.
          </p>
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
