import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { DAY_NAMES, computeOpenState } from '@/lib/site/hours';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { PageViewTracker } from '@/components/site/page-view-tracker';
import { getServerDictionary } from '@/lib/i18n/server';

type Props = { params: Promise<{ host: string }> };

export const metadata: Metadata = {
  title: 'Informations',
  description: 'Horaires, adresse et contact.',
};

export default async function InfoPage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const openState = computeOpenState(restaurant.openingHours, restaurant.timezone);
  const today = new Date().getDay();

  const entitlements = await getEntitlements(restaurant.id);
  const reviewsEnabled = hasFeature(entitlements, FEATURES.REVIEWS);
  const reviews = reviewsEnabled
    ? await prisma.review.findMany({
        where: { restaurantId: restaurant.id, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, customerName: true, rating: true, comment: true, createdAt: true },
      })
    : [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  const galleryImages = await prisma.galleryImage.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: 'asc' },
    select: { id: true, imageUrl: true, caption: true },
  });

  const socials = [
    { label: 'Facebook', url: restaurant.facebookUrl },
    { label: 'Instagram', url: restaurant.instagramUrl },
    { label: 'TikTok', url: restaurant.tiktokUrl },
  ].filter((social): social is { label: string; url: string } => Boolean(social.url));

  const { dict } = await getServerDictionary();

  const mapUrl =
    restaurant.latitude !== null && restaurant.longitude !== null
      ? `https://www.openstreetmap.org/?mlat=${restaurant.latitude}&mlon=${restaurant.longitude}#map=17/${restaurant.latitude}/${restaurant.longitude}`
      : restaurant.addressLine
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(
            [restaurant.addressLine, restaurant.city, restaurant.country]
              .filter(Boolean)
              .join(', '),
          )}`
        : null;

  return (
    <>
      <PageViewTracker restaurantId={restaurant.id} path="/infos" />

      <div className="container-page py-8 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {dict.info.title}
        </h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="horaires" className="rounded-2xl border border-surface-border p-5">
            <h2 id="horaires" className="text-sm font-medium">
              {dict.info.hours}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  openState.isOpen ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              {openState.label}
            </p>

            <dl className="mt-4 space-y-1.5 text-sm">
              {restaurant.openingHours.map((hour) => (
                <div
                  key={hour.dayOfWeek}
                  className={`flex justify-between ${
                    hour.dayOfWeek === today ? 'font-medium text-ink' : 'text-ink-muted'
                  }`}
                >
                  <dt>{DAY_NAMES[hour.dayOfWeek]}</dt>
                  <dd>
                    {hour.isClosed ? dict.info.closed : `${hour.opensAt} – ${hour.closesAt}`}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="contact" className="rounded-2xl border border-surface-border p-5">
            <h2 id="contact" className="text-sm font-medium">
              {dict.info.contact}
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              {restaurant.addressLine && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    {dict.info.address}
                  </dt>
                  <dd className="mt-0.5">
                    {restaurant.addressLine}
                    {restaurant.city && `, ${restaurant.city}`}
                    {restaurant.country && `, ${restaurant.country}`}
                  </dd>
                </div>
              )}

              {restaurant.phone && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    {dict.info.phone}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="underline underline-offset-4"
                    >
                      {restaurant.phone}
                    </a>
                  </dd>
                </div>
              )}

              {restaurant.whatsappNumber && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    WhatsApp
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`https://wa.me/${restaurant.whatsappNumber.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {restaurant.whatsappNumber}
                    </a>
                  </dd>
                </div>
              )}

              {restaurant.email && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    {dict.info.email}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`mailto:${restaurant.email}`}
                      className="underline underline-offset-4"
                    >
                      {restaurant.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            {socials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-sunken"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}

            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-11 items-center rounded-xl border border-surface-border px-4 text-sm font-medium hover:bg-surface-sunken"
              >
                {dict.info.seeOnMap}
              </a>
            )}
          </section>
        </div>

        {galleryImages.length > 0 && (
          <section aria-labelledby="galerie" className="mt-6 rounded-2xl border border-surface-border p-5">
            <h2 id="galerie" className="text-sm font-medium">
              {dict.info.gallery}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryImages.map((image) => (
                <figure key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                  <img
                    src={image.imageUrl}
                    alt={image.caption ?? ''}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  {image.caption && (
                    <figcaption className="mt-1 text-xs text-ink-muted">{image.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {reviewsEnabled && reviews.length > 0 && (
          <section aria-labelledby="avis" className="mt-6 rounded-2xl border border-surface-border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="avis" className="text-sm font-medium">
                {dict.info.reviews}
              </h2>
              {averageRating !== null && (
                <p className="text-sm">
                  <span aria-hidden="true" className="text-amber-500">
                    {'★'.repeat(Math.round(averageRating))}
                    <span className="text-surface-border">
                      {'★'.repeat(5 - Math.round(averageRating))}
                    </span>
                  </span>{' '}
                  <span className="text-ink-muted">
                    {dict.info.ratingSummary(averageRating.toFixed(1), reviews.length)}
                  </span>
                </p>
              )}
            </div>

            <ul className="mt-4 divide-y divide-surface-border">
              {reviews.map((review) => (
                <li key={review.id} className="py-3">
                  <p className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{review.customerName}</span>
                    <span aria-label={dict.info.starsOutOf5(review.rating)} className="text-amber-500">
                      {'★'.repeat(review.rating)}
                      <span className="text-surface-border">
                        {'★'.repeat(5 - review.rating)}
                      </span>
                    </span>
                  </p>
                  {review.comment && (
                    <p className="mt-1 text-sm text-ink-muted">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
