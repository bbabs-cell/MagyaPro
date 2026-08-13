import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { DAY_NAMES, computeOpenState } from '@/lib/site/hours';
import { PageViewTracker } from '@/components/site/page-view-tracker';

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

  const socials = [
    { label: 'Facebook', url: restaurant.facebookUrl },
    { label: 'Instagram', url: restaurant.instagramUrl },
    { label: 'TikTok', url: restaurant.tiktokUrl },
  ].filter((social): social is { label: string; url: string } => Boolean(social.url));

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
          Informations
        </h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="horaires" className="rounded-2xl border border-surface-border p-5">
            <h2 id="horaires" className="text-sm font-medium">
              Horaires d&apos;ouverture
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
                    {hour.isClosed ? 'Fermé' : `${hour.opensAt} – ${hour.closesAt}`}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="contact" className="rounded-2xl border border-surface-border p-5">
            <h2 id="contact" className="text-sm font-medium">
              Nous contacter
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              {restaurant.addressLine && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    Adresse
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
                    Téléphone
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
                    Email
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
                Voir sur la carte
              </a>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
