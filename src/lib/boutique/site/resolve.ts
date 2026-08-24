import { cache } from 'react';

import { prisma } from '@/lib/db';
import { rootHostname } from '@/lib/env';
import { toQty } from '@/lib/boutique/quantity';

/**
 * Résolution d'un hôte public en boutique — équivalent de
 * `src/lib/site/resolve.ts` (Restaurant). Deux formes d'identifiant, comme
 * pour Restaurant :
 *   - un slug (`ma-boutique`), pour `boutique.magyapro.com/s/<slug>` ;
 *   - un nom d'hôte complet (`ma-boutique.com`), pour un domaine
 *     personnalisé — honoré seulement s'il est **vérifié** (`StoreDomain`,
 *     voir le commentaire dans `src/middleware.ts`).
 */

export type PublicStore = NonNullable<Awaited<ReturnType<typeof loadStore>>>;

const storeSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  status: true,
  businessType: true,
  logoUrl: true,
  coverUrl: true,
  faviconUrl: true,
  primaryColor: true,
  secondaryColor: true,
  fontFamily: true,
  templateKey: true,
  phone: true,
  email: true,
  addressLine: true,
  city: true,
  country: true,
  currency: true,
  language: true,
  isDemo: true,
} as const;

async function loadStore(identifier: string) {
  const normalized = identifier.trim().toLowerCase();

  // Un identifiant contenant un point ne peut être qu'un nom d'hôte complet.
  if (normalized.includes('.') && !normalized.endsWith(`.${rootHostname()}`)) {
    const domain = await prisma.storeDomain.findFirst({
      where: { hostname: normalized, status: 'VERIFIED' },
      select: { store: { select: storeSelect } },
    });
    return domain?.store ?? null;
  }

  return prisma.store.findUnique({
    where: { slug: normalized },
    select: storeSelect,
  });
}

/**
 * Boutique publique, mémorisée pour la durée de la requête. `null` si la
 * boutique n'existe pas ou n'est pas active — un brouillon ou une boutique
 * suspendue reste invisible du public.
 */
export const resolvePublicStore = cache(async (identifier: string) => {
  const store = await loadStore(identifier);
  if (!store || store.status !== 'ACTIVE') return null;
  return store;
});

/** Catégories publiables : celles qui contiennent au moins un produit actif visible. */
export const loadPublicCategories = cache(async (storeId: string) => {
  const categories = await prisma.storeCategory.findMany({
    where: { storeId, products: { some: { status: 'ACTIVE' } } },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
  });
  return categories;
});

export type PublicProduct = Awaited<ReturnType<typeof loadPublicProducts>>[number];

/** Produits visibles publiquement, avec le prix et le stock agrégé de leur variante par défaut. */
export const loadPublicProducts = cache(async (storeId: string, categoryId?: string) => {
  const products = await prisma.storeProduct.findMany({
    where: { storeId, status: 'ACTIVE', ...(categoryId ? { categoryId } : {}) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      unit: true,
      category: { select: { id: true, name: true } },
      variants: {
        where: { isActive: true },
        take: 1,
        select: {
          id: true,
          price: true,
          salePrice: true,
          attributes: true,
          inventory: { select: { quantity: true } },
        },
      },
    },
  });

  return products
    .filter((product) => product.variants.length > 0)
    .map((product) => {
      const variant = product.variants[0]!;
      const stock = variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        unit: product.unit,
        category: product.category,
        variantId: variant.id,
        price: variant.salePrice ?? variant.price,
        compareAtPrice: variant.salePrice ? variant.price : null,
        attributes: (variant.attributes ?? {}) as Record<string, string>,
        stock,
      };
    });
});

export const loadPublicProduct = cache(async (storeId: string, productId: string) => {
  const product = await prisma.storeProduct.findFirst({
    where: { id: productId, storeId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      unit: true,
      category: { select: { id: true, name: true } },
      brand: { select: { name: true } },
      variants: {
        where: { isActive: true },
        take: 1,
        select: {
          id: true,
          price: true,
          salePrice: true,
          attributes: true,
          inventory: { select: { quantity: true } },
        },
      },
    },
  });
  if (!product || product.variants.length === 0) return null;

  const variant = product.variants[0]!;
  const stock = variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    unit: product.unit,
    category: product.category,
    brand: product.brand,
    price: variant.salePrice ?? variant.price,
    compareAtPrice: variant.salePrice ? variant.price : null,
    attributes: (variant.attributes ?? {}) as Record<string, string>,
    stock,
  };
});
