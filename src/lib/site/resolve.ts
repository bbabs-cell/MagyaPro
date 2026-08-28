import { cache } from 'react';

import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { rootHostname } from '@/lib/env';

/**
 * Résolution d'un hôte public en restaurant.
 *
 * Deux formes d'identifiant arrivent ici, toutes deux produites par le
 * middleware :
 *   - un slug (`chez-fatou`), issu d'un sous-domaine de la plateforme ;
 *   - un nom d'hôte complet (`mon-resto.com`), pour un domaine personnalisé.
 *
 * Un domaine personnalisé n'est honoré que s'il est **vérifié** : sans cela,
 * n'importe qui pourrait faire pointer son domaine vers la plateforme et
 * afficher le site d'un restaurant sous sa propre adresse.
 */

export type PublicRestaurant = NonNullable<
  Awaited<ReturnType<typeof loadRestaurant>>
>;

const restaurantSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  status: true,
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
  latitude: true,
  longitude: true,
  facebookUrl: true,
  instagramUrl: true,
  tiktokUrl: true,
  whatsappNumber: true,
  chefName: true,
  chefBio: true,
  chefPhoto: true,
  seoTitle: true,
  seoDescription: true,
  seoImageUrl: true,
  currency: true,
  timezone: true,
  isDemo: true,
  settings: true,
  openingHours: { orderBy: { dayOfWeek: 'asc' } },
} as const;

async function loadRestaurant(identifier: string) {
  const normalized = identifier.trim().toLowerCase();

  // Un identifiant contenant un point ne peut être qu'un nom d'hôte.
  if (normalized.includes('.') && !normalized.endsWith(`.${rootHostname()}`)) {
    const domain = await prisma.domain.findFirst({
      where: { hostname: normalized, status: 'VERIFIED' },
      select: { restaurant: { select: restaurantSelect } },
    });
    return domain?.restaurant ?? null;
  }

  return prisma.restaurant.findUnique({
    where: { slug: normalized },
    select: restaurantSelect,
  });
}

/**
 * Restaurant public, mémorisé pour la durée de la requête : la page, ses
 * métadonnées et le layout partagent la même lecture.
 *
 * Renvoie `null` si le restaurant n'existe pas, n'est pas publié, ou n'a plus
 * d'abonnement en cours — un brouillon, un restaurant suspendu et un
 * restaurant impayé sont invisibles du public.
 *
 * Les restaurants de démonstration échappent à ce contrôle : ils n'ont pas
 * d'abonnement et servent la vitrine commerciale de MagyaPro.
 */
export const resolvePublicRestaurant = cache(async (identifier: string) => {
  const restaurant = await loadRestaurant(identifier);
  if (!restaurant || restaurant.status !== 'ACTIVE') return null;
  if (restaurant.isDemo) return restaurant;

  const entitlements = await getEntitlements(restaurant.id);
  if (!entitlements.isActive) return null;

  return restaurant;
});

/** Menu publiable : catégories actives contenant au moins un produit visible. */
export const loadPublicMenu = cache(async (restaurantId: string) => {
  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { position: 'asc' },
    include: {
      products: {
        orderBy: { position: 'asc' },
        include: {
          variants: { where: { isAvailable: true }, orderBy: { position: 'asc' } },
          optionGroups: {
            orderBy: { position: 'asc' },
            include: {
              options: { where: { isAvailable: true }, orderBy: { position: 'asc' } },
            },
          },
        },
      },
    },
  });

  // Une catégorie vide n'a rien à afficher : on la retire plutôt que de
  // montrer un intitulé sans contenu.
  return categories.filter((category) => category.products.length > 0);
});

export const loadDeliveryZones = cache(async (restaurantId: string) => {
  return prisma.deliveryZone.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, fee: true, minOrder: true, freeAbove: true },
  });
});
