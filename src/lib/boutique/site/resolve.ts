import { cache } from 'react';

import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';

/**
 * Résolution d'un hôte public en boutique — équivalent de
 * `src/lib/site/resolve.ts` (Restaurant), fichier séparé et volontairement
 * plus simple : l'identifiant est toujours un slug, jamais un nom d'hôte
 * complet. Le catalogue d'une boutique est atteint via
 * `boutique.magyapro.com/s/<slug>` plutôt qu'un sous-domaine dédié par
 * boutique (voir le commentaire dans `src/middleware.ts` — bloqué par le
 * registrar actuel) ; les domaines personnalisés de boutique (`StoreDomain`)
 * ne sont pas non plus branchés au routage, cette fonction n'a donc qu'un
 * identifiant à traiter, contrairement à son équivalent Restaurant.
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
  primaryColor: true,
  secondaryColor: true,
  phone: true,
  email: true,
  addressLine: true,
  city: true,
  country: true,
  currency: true,
  isDemo: true,
} as const;

async function loadStore(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
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
