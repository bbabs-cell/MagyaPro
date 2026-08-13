import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { getEntitlements } from '@/lib/entitlements';
import { MenuManager } from '@/components/dashboard/menu-manager';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Menu' };
export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const context = await requireTenant('menu:view');

  const [categories, products, entitlements] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { position: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: [{ categoryId: 'asc' }, { position: 'asc' }],
      include: {
        variants: { orderBy: { position: 'asc' } },
        optionGroups: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
      },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  return (
    <>
      <PageHeader
        title="Menu"
        description="Vos catégories et vos plats. Les modifications sont visibles immédiatement sur votre site."
      />

      <MenuManager
        canManage={context.permissions.has('menu:manage')}
        currency={context.restaurant.currency}
        limits={{
          maxCategories: entitlements.limits.maxCategories,
          maxProducts: entitlements.limits.maxProducts,
        }}
        initialCategories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          isActive: category.isActive,
          productCount: category._count.products,
        }))}
        initialProducts={products.map((product) => ({
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          isAvailable: product.isAvailable,
          badge: product.badge,
          variants: product.variants.map((variant) => ({
            name: variant.name,
            price: variant.price,
            isAvailable: variant.isAvailable,
          })),
          optionGroups: product.optionGroups.map((group) => ({
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            options: group.options.map((option) => ({
              name: option.name,
              priceDelta: option.priceDelta,
              isAvailable: option.isAvailable,
            })),
          })),
        }))}
      />
    </>
  );
}
