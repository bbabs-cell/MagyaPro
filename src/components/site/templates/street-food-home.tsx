import Link from 'next/link';

import { cx } from '@/components/ui';
import { DAY_NAMES } from '@/lib/site/hours';
import { OfferCountdown } from '@/components/site/templates/offer-countdown';
import { StreetFoodMenuFilter } from '@/components/site/templates/street-food-menu-filter';
import type { HeroData, MenuCategoryData } from '@/components/site/templates';

/**
 * Page d'accueil dédiée au template « street-food » — une seule page qui
 * défile, dans le registre énergique de la restauration rapide moderne :
 * bandeau défilant, badges de statut flottants, carte filtrable, offre en
 * compte à rebours (si une promotion active existe), galerie et avis.
 *
 * Comme « elegant », ce template s'écarte de la structure héros + aperçu des
 * trois autres : c'est ce qui lui donne sa propre identité plutôt qu'une
 * simple variante de couleurs.
 */

export type StreetFoodHomeData = {
  hero: HeroData;
  story: string | null;
  chef: { name: string; bio: string | null; photoUrl: string | null } | null;
  menuCategories: MenuCategoryData[];
  menuHref: string;
  currency: string;
  gallery: Array<{ id: string; imageUrl: string; caption: string | null }>;
  reviewsEnabled: boolean;
  reviews: Array<{ id: string; customerName: string; rating: number; comment: string | null }>;
  averageRating: number | null;
  openingHours: Array<{ dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string }>;
  today: number;
  offer: { code: string; label: string; endsAt: string } | null;
  location: {
    addressLine: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    email: string | null;
    mapEmbedSrc: string | null;
    mapLinkUrl: string | null;
  };
};

export function StreetFoodHomePage({ data }: { data: StreetFoodHomeData }) {
  const hasStory = Boolean(data.story);
  const hasChef = Boolean(data.chef?.name);
  const hasGallery = data.gallery.length > 0;
  const hasReviews = data.reviewsEnabled && data.reviews.length > 0;
  const categoryNames = data.menuCategories.map((category) => category.name);

  return (
    <>
      <StreetFoodHero data={data.hero} averageRating={data.averageRating} reviewCount={data.reviews.length} />

      {categoryNames.length > 0 && <MarqueeStrip items={categoryNames} />}

      {hasStory && <StorySection story={data.story!} />}
      {hasChef && <ChefSection chef={data.chef!} />}

      <MenuSection categories={data.menuCategories} currency={data.currency} menuHref={data.menuHref} />

      {data.offer && <OfferSection offer={data.offer} />}
      {hasGallery && <GallerySection images={data.gallery} />}
      {hasReviews && <ReviewsSection reviews={data.reviews} averageRating={data.averageRating} />}

      <LocationSection
        location={data.location}
        openingHours={data.openingHours}
        today={data.today}
        isOpenNow={data.hero.isOpenNow}
        openLabel={data.hero.openLabel}
      />
    </>
  );
}

// -------------------------------------------------------------------- Hero

function StreetFoodHero({
  data,
  averageRating,
  reviewCount,
}: {
  data: HeroData;
  averageRating: number | null;
  reviewCount: number;
}) {
  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: 'var(--brand)' }}>
      <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

      <div className="container-page relative grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
            <span
              aria-hidden="true"
              className={cx('h-2 w-2 rounded-full', data.isOpenNow ? 'bg-emerald-400' : 'bg-red-300')}
            />
            {data.openLabel}
          </span>

          <h1 className="mt-5 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mt-5 max-w-lg text-lg text-white/90">{data.description}</p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={data.menuHref}
              className="inline-flex h-14 items-center rounded-full bg-black px-8 text-sm font-black uppercase tracking-wide text-white shadow-[6px_6px_0_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 hover:shadow-[8px_8px_0_rgba(0,0,0,0.3)]"
            >
              {data.orderingEnabled ? 'Commander maintenant' : 'Voir le menu'}
            </Link>
            <Link
              href={data.infosHref}
              className="inline-flex h-14 items-center rounded-full border-2 border-white px-8 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
            >
              Nous trouver
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-square overflow-hidden rounded-[2.5rem] border-4 border-white/20 shadow-2xl">
            {data.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image de tenant
              <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-black/15" />
            )}
          </div>

          {averageRating !== null && (
            <div className="absolute -left-4 top-6 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-black shadow-lg">
              <span className="text-lg">★</span>
              <div className="leading-tight">
                <span className="block text-sm font-black">{averageRating.toFixed(1)}/5</span>
                <span className="block text-[0.65rem] text-ink-muted">{reviewCount} avis</span>
              </div>
            </div>
          )}

          <div className="absolute -bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-black shadow-lg">
            <span
              aria-hidden="true"
              className={cx('h-2.5 w-2.5 rounded-full', data.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
            />
            <span className="text-sm font-black">{data.isOpenNow ? 'Ouvert' : 'Fermé'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Bandeau défilant continu, sans script — une seule liste dupliquée animée en CSS. */
export function MarqueeStrip({ items }: { items: string[] }) {
  const track = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-ink bg-ink py-3 text-surface">
      <div className="marquee-track flex w-max gap-10 whitespace-nowrap">
        {track.map((item, index) => (
          <span key={index} className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--brand)' }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Sections

function StorySection({ story }: { story: string }) {
  return (
    <section className="border-b border-surface-border bg-surface">
      <div className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--brand)' }}>
            Notre histoire
          </span>
          <p className="mx-auto mt-6 max-w-xl font-display text-2xl font-medium leading-relaxed sm:text-3xl">
            {story}
          </p>
        </div>
      </div>
    </section>
  );
}

function ChefSection({
  chef,
}: {
  chef: { name: string; bio: string | null; photoUrl: string | null };
}) {
  return (
    <section className="border-b border-surface-border bg-surface-sunken">
      <div className="container-page py-16 sm:py-20">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
          {chef.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- photo de tenant
            <img
              src={chef.photoUrl}
              alt=""
              className="h-28 w-28 rounded-full border-4 object-cover shadow-lg"
              style={{ borderColor: 'var(--brand)' }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-28 w-28 items-center justify-center rounded-full border-4 bg-surface font-display text-4xl"
              style={{ borderColor: 'var(--brand)' }}
            >
              {chef.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-ink-faint">Aux fourneaux</span>
            <p className="mt-2 font-display text-3xl font-semibold">{chef.name}</p>
            {chef.bio && <p className="mt-3 leading-relaxed text-ink-muted">{chef.bio}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function MenuSection({
  categories,
  currency,
  menuHref,
}: {
  categories: MenuCategoryData[];
  currency: string;
  menuHref: string;
}) {
  return (
    <section id="menu" className="border-b border-surface-border bg-surface">
      <div className="container-page py-16 sm:py-20">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--brand)' }}>
            Ce qui cuisine
          </span>
          <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">Notre menu</h2>
        </div>

        {categories.length === 0 ? (
          <p className="text-center text-ink-muted">La carte est en préparation.</p>
        ) : (
          <StreetFoodMenuFilter categories={categories} currency={currency} />
        )}

        <div className="mt-12 text-center">
          <Link
            href={menuHref}
            className="inline-flex h-12 items-center rounded-full border-2 border-ink px-8 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-surface"
          >
            Voir la carte complète
          </Link>
        </div>
      </div>
    </section>
  );
}

function OfferSection({ offer }: { offer: { code: string; label: string; endsAt: string } }) {
  return (
    <section className="relative overflow-hidden bg-[#141110] text-white">
      <div className="container-page relative grid gap-8 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
            Offre limitée
          </span>
          <h2 className="mt-4 font-display text-4xl font-black leading-tight sm:text-5xl">{offer.label}</h2>
          <p className="mt-4 text-white/70">
            Code <span className="font-mono font-bold text-white">{offer.code}</span> à mentionner lors de votre commande.
          </p>
        </div>
        <div className="flex justify-start lg:justify-end">
          <OfferCountdown endsAt={offer.endsAt} />
        </div>
      </div>
    </section>
  );
}

function GallerySection({
  images,
}: {
  images: Array<{ id: string; imageUrl: string; caption: string | null }>;
}) {
  return (
    <section className="border-b border-surface-border bg-surface-sunken">
      <div className="container-page py-16 sm:py-20">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--brand)' }}>
            En cuisine
          </span>
          <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">Galerie</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <figure key={image.id} className="group relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
              <img
                src={image.imageUrl}
                alt={image.caption ?? ''}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {image.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewsSection({
  reviews,
  averageRating,
}: {
  reviews: Array<{ id: string; customerName: string; rating: number; comment: string | null }>;
  averageRating: number | null;
}) {
  return (
    <section className="border-b border-surface-border bg-surface">
      <div className="container-page py-16 sm:py-20">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--brand)' }}>
            Avis clients
          </span>
          <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">Ils en parlent</h2>
          {averageRating !== null && (
            <p className="mt-3 text-amber-500">
              {'★'.repeat(Math.round(averageRating))}
              <span className="text-surface-border">{'★'.repeat(5 - Math.round(averageRating))}</span>
              <span className="ml-2 text-sm text-ink-muted">{averageRating.toFixed(1)} sur 5</span>
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 6).map((review) => (
            <figure key={review.id} className="rounded-2xl border-2 border-ink p-5">
              <div className="text-amber-500">{'★'.repeat(review.rating)}</div>
              {review.comment && <blockquote className="mt-3 text-sm leading-relaxed">{review.comment}</blockquote>}
              <figcaption className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                {review.customerName}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocationSection({
  location,
  openingHours,
  today,
  isOpenNow,
  openLabel,
}: {
  location: StreetFoodHomeData['location'];
  openingHours: StreetFoodHomeData['openingHours'];
  today: number;
  isOpenNow: boolean;
  openLabel: string;
}) {
  return (
    <section className="bg-[#141110] text-white">
      <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">Horaires &amp; Localisation</span>

          <p className="mt-6 flex items-center gap-2 text-sm text-white/80">
            <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', isOpenNow ? 'bg-emerald-400' : 'bg-red-400')} />
            {openLabel}
          </p>

          {(location.addressLine || location.city) && (
            <p className="mt-6 font-display text-2xl font-semibold">
              {[location.addressLine, location.city, location.country].filter(Boolean).join(', ')}
            </p>
          )}

          <dl className="mt-8 space-y-3 text-sm">
            {openingHours.map((hour) => (
              <div
                key={hour.dayOfWeek}
                className={cx(
                  'flex justify-between border-b border-white/10 pb-2',
                  hour.dayOfWeek === today ? 'text-white' : 'text-white/50',
                )}
              >
                <dt>{DAY_NAMES[hour.dayOfWeek]}</dt>
                <dd>{hour.isClosed ? 'Fermé' : `${hour.opensAt} – ${hour.closesAt}`}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {location.phone && (
              <a href={`tel:${location.phone}`} className="rounded-full border-2 border-white/40 px-4 py-2 font-bold hover:border-white">
                {location.phone}
              </a>
            )}
            {location.whatsappNumber && (
              <a
                href={`https://wa.me/${location.whatsappNumber.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-2 border-white/40 px-4 py-2 font-bold hover:border-white"
              >
                WhatsApp
              </a>
            )}
            {location.email && (
              <a href={`mailto:${location.email}`} className="rounded-full border-2 border-white/40 px-4 py-2 font-bold hover:border-white">
                {location.email}
              </a>
            )}
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border-2 border-white/15">
          {location.mapEmbedSrc ? (
            <iframe
              title="Localisation du restaurant"
              src={location.mapEmbedSrc}
              className="h-full min-h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : location.mapLinkUrl ? (
            <a
              href={location.mapLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full min-h-[320px] w-full items-center justify-center text-sm text-white/70 hover:text-white"
            >
              Voir sur la carte →
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
