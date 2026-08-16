import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { loadPublicMenu, resolvePublicRestaurant } from '@/lib/site/resolve';
import { computeOpenState } from '@/lib/site/hours';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { templateRenderer } from '@/components/site/templates';
import { ElegantHomePage } from '@/components/site/templates/elegant-home';
import { MarqueeStrip, StreetFoodHomePage } from '@/components/site/templates/street-food-home';
import { PrestigeHomePage } from '@/components/site/templates/prestige-home';
import { PageViewTracker } from '@/components/site/page-view-tracker';
import { StructuredData } from '@/components/site/structured-data';
import { getServerDictionary } from '@/lib/i18n/server';
import { localize, localizeNullable } from '@/lib/i18n/content';

type Props = { params: Promise<{ host: string }> };

/**
 * URL de la carte OpenStreetMap intégrée (`iframe`), ou `null` sans
 * coordonnées connues — l'embed OSM a besoin d'un point précis (une adresse
 * texte ne suffit pas, contrairement au lien de secours ci-dessous).
 * Gratuit et sans clé à configurer.
 */
function mapEmbedSrc(params: { latitude: number | null; longitude: number | null }): string | null {
  if (params.latitude === null || params.longitude === null) return null;

  const delta = 0.006;
  const bbox = [
    params.longitude - delta,
    params.latitude - delta,
    params.longitude + delta,
    params.latitude + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${params.latitude},${params.longitude}`;
}

function mapLinkUrl(params: {
  latitude: number | null;
  longitude: number | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
}): string | null {
  if (params.latitude !== null && params.longitude !== null) {
    return `https://www.openstreetmap.org/?mlat=${params.latitude}&mlon=${params.longitude}#map=17/${params.latitude}/${params.longitude}`;
  }
  const query = [params.addressLine, params.city, params.country].filter(Boolean).join(', ');
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : null;
}

export default async function RestaurantHomePage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const categories = await loadPublicMenu(restaurant.id);
  const openState = computeOpenState(restaurant.openingHours, restaurant.timezone);

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
      hasOptions: product.variants.length > 0 || product.optionGroups.length > 0,
    })),
  }));

  const heroData = {
    name: restaurant.name,
    description: restaurant.description,
    coverUrl: restaurant.coverUrl,
    logoUrl: restaurant.logoUrl,
    city: restaurant.city,
    addressLine: restaurant.addressLine,
    phone: restaurant.phone,
    primaryColor: restaurant.primaryColor,
    isOpenNow: openState.isOpen,
    openLabel: openState.label,
    menuHref: `${base}/menu`,
    infosHref: `${base}/infos`,
    orderingEnabled,
  };

  // « elegant », « street-food » et « prestige » sont des pages uniques qui
  // défilent (histoire, chef, galerie, avis, localisation) plutôt que la
  // structure héros + aperçu des autres templates : c'est ce qui les
  // distingue vraiment, pas seulement leur palette.
  const ONE_PAGE_TEMPLATES = new Set(['elegant', 'street-food', 'prestige']);
  if (ONE_PAGE_TEMPLATES.has(restaurant.templateKey)) {
    const now = new Date();
    const [entitlements, galleryImages, reviews, activePromotion] = await Promise.all([
      getEntitlements(restaurant.id),
      prisma.galleryImage.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { position: 'asc' },
        select: { id: true, imageUrl: true, caption: true },
      }),
      prisma.review.findMany({
        where: { restaurantId: restaurant.id, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, customerName: true, rating: true, comment: true },
      }),
      prisma.promotion.findFirst({
        where: {
          restaurantId: restaurant.id,
          isActive: true,
          endsAt: { gt: now },
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        orderBy: { endsAt: 'asc' },
        select: { code: true, type: true, value: true, endsAt: true },
      }),
    ]);

    const reviewsEnabled = hasFeature(entitlements, FEATURES.REVIEWS);
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : null;

    const commonData = {
      hero: heroData,
      story: restaurant.description,
      chef: restaurant.chefName
        ? { name: restaurant.chefName, bio: restaurant.chefBio, photoUrl: restaurant.chefPhoto }
        : null,
      menuCategories: preview,
      menuHref: `${base}/menu`,
      currency: restaurant.currency,
      gallery: galleryImages,
      reviewsEnabled,
      reviews,
      averageRating,
      openingHours: restaurant.openingHours,
      today: new Date().getDay(),
      location: {
        addressLine: restaurant.addressLine,
        city: restaurant.city,
        country: restaurant.country,
        phone: restaurant.phone,
        whatsappNumber: restaurant.whatsappNumber,
        email: restaurant.email,
        mapEmbedSrc: mapEmbedSrc(restaurant),
        mapLinkUrl: mapLinkUrl(restaurant),
      },
    };

    return (
      <>
        <PageViewTracker restaurantId={restaurant.id} path="/" />
        <StructuredData restaurant={restaurant} openState={openState} />

        {restaurant.templateKey === 'elegant' ? (
          <ElegantHomePage data={commonData} />
        ) : restaurant.templateKey === 'prestige' ? (
          <PrestigeHomePage data={commonData} />
        ) : (
          <StreetFoodHomePage
            data={{
              ...commonData,
              offer: activePromotion
                ? {
                    code: activePromotion.code,
                    label:
                      activePromotion.type === 'PERCENT'
                        ? `${activePromotion.value}% de réduction`
                        : `${formatMoney(activePromotion.value, restaurant.currency)} de réduction`,
                    endsAt: activePromotion.endsAt!.toISOString(),
                  }
                : null,
            }}
          />
        )}
      </>
    );
  }

  const { Hero, Menu } = templateRenderer(restaurant.templateKey);
  // Le bandeau défilant est un élément partagé entre plusieurs identités
  // (introduit avec « street-food ») — sauf « elegant », dont le calme
  // délibéré ne s'accorde pas avec un défilement continu.
  const showMarquee = restaurant.templateKey !== 'elegant' && categories.length > 0;

  return (
    <>
      <PageViewTracker restaurantId={restaurant.id} path="/" />
      <StructuredData restaurant={restaurant} openState={openState} />

      <Hero data={heroData} />
      {showMarquee && <MarqueeStrip items={categories.map((category) => category.name)} />}

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
