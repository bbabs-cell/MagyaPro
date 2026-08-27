import { cache } from 'react';

import { prisma } from '@/lib/db';
import { rootHostname } from '@/lib/env';
import { toQty } from '@/lib/boutique/quantity';
import { parseVariantAxes } from '@/lib/boutique/variants';

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

/**
 * Produits visibles publiquement.
 *
 * Le stock affiché agrège toutes les déclinaisons actives : sur la grille, il
 * ne répond qu'à « ce produit est-il disponible ? ». Le choix d'une taille
 * précise, et le stock qui lui correspond, se font sur la fiche — sans quoi
 * un t-shirt disponible en XL seulement s'annoncerait en rupture.
 */
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
      variantAxes: true,
      category: { select: { id: true, name: true } },
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
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
      const stock = product.variants.reduce(
        (sum, variant) =>
          sum + variant.inventory.reduce((vSum, inv) => vSum + toQty(inv.quantity), 0),
        0,
      );
      const prices = product.variants.map((variant) => variant.salePrice ?? variant.price);
      const cheapest = product.variants.reduce((best, variant) =>
        (variant.salePrice ?? variant.price) < (best.salePrice ?? best.price) ? variant : best,
      );

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        unit: product.unit,
        category: product.category,
        /** Déclinaison la moins chère — celle dont le prix s'affiche sur la grille. */
        variantId: cheapest.id,
        price: cheapest.salePrice ?? cheapest.price,
        compareAtPrice: cheapest.salePrice ? cheapest.price : null,
        /** Vrai quand les déclinaisons n'ont pas toutes le même prix : la
         *  grille annonce alors « à partir de ». */
        priceVaries: new Set(prices).size > 1,
        hasDeclinations: parseVariantAxes(product.variantAxes).length > 0,
        attributes: (cheapest.attributes ?? {}) as Record<string, string>,
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
      variantAxes: true,
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
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

  const axes = parseVariantAxes(product.variantAxes);
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    price: variant.salePrice ?? variant.price,
    compareAtPrice: variant.salePrice ? variant.price : null,
    attributes: (variant.attributes ?? {}) as Record<string, string>,
    stock: variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0),
  }));

  // Prix d'appel de la fiche : celui de la déclinaison la moins chère, comme
  // sur la grille, pour qu'un visiteur ne découvre pas un prix différent en
  // ouvrant le produit.
  const cheapest = variants.reduce((best, variant) => (variant.price < best.price ? variant : best));

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    unit: product.unit,
    category: product.category,
    brand: product.brand,
    axes,
    variants,
    price: cheapest.price,
    compareAtPrice: cheapest.compareAtPrice,
    priceVaries: new Set(variants.map((variant) => variant.price)).size > 1,
    attributes: cheapest.attributes,
    stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
  };
});
