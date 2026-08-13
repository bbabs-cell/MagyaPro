import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { ProductOrderForm } from '@/components/site/product-order-form';

type Props = { params: Promise<{ host: string; slug: string }> };

/**
 * Charge un produit publiable.
 *
 * Le filtre `restaurantId` est appliqué dans la requête : le slug d'un produit
 * d'un autre restaurant ne remonte rien, même s'il existe sur la plateforme.
 */
async function loadProduct(restaurantId: string, slug: string) {
  return prisma.product.findFirst({
    where: { restaurantId, slug, category: { isActive: true } },
    include: {
      category: { select: { name: true } },
      variants: { where: { isAvailable: true }, orderBy: { position: 'asc' } },
      optionGroups: {
        orderBy: { position: 'asc' },
        include: {
          options: { where: { isAvailable: true }, orderBy: { position: 'asc' } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, slug } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) return {};

  const product = await loadProduct(restaurant.id, slug);
  if (!product) return { title: 'Plat introuvable' };

  return {
    title: product.name,
    description:
      product.description ?? `${product.name} — ${restaurant.name}`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { host, slug } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const product = await loadProduct(restaurant.id, slug);
  if (!product) notFound();

  const orderingEnabled = restaurant.settings?.orderingEnabled ?? true;

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image de tenant
            <img
              src={product.imageUrl}
              alt={product.name}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="aspect-[4/3] w-full rounded-2xl bg-surface-sunken"
            />
          )}
        </div>

        <div>
          <p className="text-sm text-ink-muted">{product.category.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-3 text-ink-muted">{product.description}</p>
          )}

          <div className="mt-6">
            <ProductOrderForm
              host={host}
              currency={restaurant.currency}
              orderingEnabled={orderingEnabled}
              product={{
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                isAvailable: product.isAvailable && product.badge !== 'SOLD_OUT',
                variants: product.variants.map((variant) => ({
                  id: variant.id,
                  name: variant.name,
                  price: variant.price,
                })),
                optionGroups: product.optionGroups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  minSelect: group.minSelect,
                  maxSelect: group.maxSelect,
                  options: group.options.map((option) => ({
                    id: option.id,
                    name: option.name,
                    priceDelta: option.priceDelta,
                  })),
                })),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
