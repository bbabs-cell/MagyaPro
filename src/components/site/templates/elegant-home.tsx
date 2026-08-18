import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { DAY_NAMES } from '@/lib/site/hours';
import { QuickAddButton } from '@/components/site/quick-add-button';
import type { HeroData, MenuCategoryData } from '@/components/site/templates';

/**
 * Page d'accueil dédiée au template « elegant » — une seule page qui défile,
 * à la manière des sites de restaurants gastronomiques : histoire, chef,
 * carte, galerie, avis et localisation s'enchaînent plutôt que d'être
 * dispersés sur plusieurs URL. Les autres templates gardent la structure
 * multi-pages (accueil courte + `/menu`, `/infos`…) : celle-ci est propre à
 * « elegant », qui vise justement à se démarquer des quatre autres.
 */

export type ElegantHomeData = {
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

const SECTION_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-[0.4em] text-ink-faint';

export function ElegantHomePage({ data }: { data: ElegantHomeData }) {
  const hasStory = Boolean(data.story);
  const hasChef = Boolean(data.chef?.name);
  const hasGallery = data.gallery.length > 0;
  const hasReviews = data.reviewsEnabled && data.reviews.length > 0;

  const sections = [
    hasStory && { id: 'histoire', label: 'Histoire' },
    hasChef && { id: 'chef', label: 'Chef' },
    { id: 'carte', label: 'Carte' },
    hasGallery && { id: 'galerie', label: 'Galerie' },
    hasReviews && { id: 'avis', label: 'Avis' },
    { id: 'localisation', label: 'Nous trouver' },
  ].filter((section): section is { id: string; label: string } => Boolean(section));

  return (
    <>
      <ElegantHero data={data.hero} />

      {sections.length > 1 && (
        <nav
          aria-label="Sections de la page"
          className="sticky top-16 z-10 flex justify-center gap-6 overflow-x-auto border-b border-surface-border bg-surface/95 px-4 py-3 backdrop-blur"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 text-xs font-medium uppercase tracking-[0.2em] text-ink-muted transition-colors hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>
      )}

      {hasStory && <StorySection story={data.story!} />}
      {hasChef && <ChefSection chef={data.chef!} />}

      <MenuSection
        categories={data.menuCategories}
        currency={data.currency}
        menuHref={data.menuHref}
      />

      {hasGallery && <GallerySection images={data.gallery} />}
      {hasReviews && (
        <ReviewsSection reviews={data.reviews} averageRating={data.averageRating} />
      )}

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

function ElegantHero({ data }: { data: HeroData }) {
  const hasPhoto = Boolean(data.coverUrl);

  return (
    <section
      className={cx(
        'relative isolate flex min-h-[85vh] items-center overflow-hidden',
        !hasPhoto && 'bg-surface',
      )}
    >
      {hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
          <img
            src={data.coverUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70"
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[24rem] font-semibold leading-none text-surface-sunken sm:text-[32rem]"
        >
          {data.name.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="container-page relative py-28 sm:py-40">
        <div className={cx('mx-auto max-w-xl text-center', hasPhoto && 'text-white')}>
          <p
            className={cx(
              'text-xs font-semibold uppercase tracking-[0.4em]',
              hasPhoto ? 'text-white/70' : 'text-ink-faint',
            )}
          >
            {data.city ?? 'Restaurant'}
          </p>
          <h1 className="mt-6 font-display text-6xl font-normal tracking-tight sm:text-7xl">
            {data.name}
          </h1>
          <span
            aria-hidden="true"
            className={cx('mx-auto mt-8 block h-px w-16', hasPhoto ? 'bg-white/30' : 'bg-ink/20')}
          />
          {data.description && (
            <p
              className={cx(
                'mx-auto mt-8 max-w-md text-lg leading-relaxed',
                hasPhoto ? 'text-white/85' : 'text-ink-muted',
              )}
            >
              {data.description}
            </p>
          )}
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href={data.menuHref}
              className={cx(
                'inline-flex h-14 items-center rounded-none border px-10 text-sm font-medium uppercase tracking-widest transition-colors',
                hasPhoto
                  ? 'border-white text-white hover:bg-white hover:text-black'
                  : 'border-ink text-ink hover:bg-ink hover:text-surface',
              )}
            >
              {data.orderingEnabled ? 'Réserver ou commander' : 'Voir le menu'}
            </Link>
            <p
              className={cx(
                'flex items-center gap-2 text-xs',
                hasPhoto ? 'text-white/70' : 'text-ink-faint',
              )}
            >
              <span
                aria-hidden="true"
                className={cx('h-1.5 w-1.5 rounded-full', data.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
              />
              {data.openLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection({ story }: { story: string }) {
  return (
    <section id="histoire" aria-labelledby="histoire-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="histoire-titre" className={SECTION_LABEL_CLASS}>
            Notre histoire
          </h2>
          <p className="mx-auto mt-8 max-w-xl font-display text-2xl leading-relaxed sm:text-3xl">
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
  const hasPhoto = Boolean(chef.photoUrl);

  return (
    <section
      id="chef"
      aria-labelledby="chef-titre"
      className={cx(
        'relative isolate flex min-h-[70vh] items-center overflow-hidden border-t border-surface-border',
        !hasPhoto && 'bg-surface-sunken',
      )}
    >
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- photo de tenant */}
          <img
            src={chef.photoUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"
          />
        </>
      )}

      <div className="container-page relative py-20 sm:py-28">
        <div className={cx('mx-auto max-w-lg text-center', hasPhoto && 'text-white')}>
          <h2
            id="chef-titre"
            className={cx(
              'text-xs font-semibold uppercase tracking-[0.4em]',
              hasPhoto ? 'text-white/70' : 'text-ink-faint',
            )}
          >
            Le chef
          </h2>
          {!hasPhoto && (
            <span
              aria-hidden="true"
              className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-surface font-display text-4xl"
            >
              {chef.name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="mt-4 font-display text-4xl">{chef.name}</p>
          {chef.bio && (
            <p className={cx('mx-auto mt-4 max-w-md leading-relaxed', !hasPhoto && 'text-ink-muted')}>
              {chef.bio}
            </p>
          )}
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
    <section id="carte" aria-labelledby="carte-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <h2 id="carte-titre" className={cx(SECTION_LABEL_CLASS, 'text-center')}>
          La carte
        </h2>

        {categories.length === 0 ? (
          <p className="mt-8 text-center text-ink-muted">La carte est en préparation.</p>
        ) : (
          <div className="mx-auto mt-12 max-w-2xl space-y-14">
            {categories.map((category) => (
              <div key={category.id}>
                <h3 className="text-center font-display text-2xl">{category.name}</h3>
                <div className="mx-auto mt-6 max-w-lg divide-y divide-surface-border text-left">
                  {category.products.map((product) => (
                    <div
                      key={product.id}
                      className={cx('flex items-center gap-5 py-5', !product.isAvailable && 'opacity-50')}
                    >
                      <Link href={product.href} className="flex min-w-0 flex-1 items-center gap-5">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                          <img
                            src={product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-24 w-24 shrink-0 rounded-full object-cover ring-1 ring-surface-border"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-24 w-24 shrink-0 rounded-full bg-surface-sunken"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="font-display text-xl">{product.name}</span>
                          {product.description && (
                            <span className="mt-1.5 block text-sm italic text-ink-muted">
                              {product.description}
                            </span>
                          )}
                        </span>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm tracking-wide text-ink-muted">
                          {formatMoney(product.price, currency)}
                        </span>
                        <QuickAddButton
                          product={product}
                          className="text-xs uppercase tracking-widest text-ink-faint hover:text-ink"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href={menuHref}
            className="inline-flex h-12 items-center border-b border-ink text-sm font-medium uppercase tracking-widest text-ink"
          >
            Voir la carte complète
          </Link>
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
    <section id="galerie" aria-labelledby="galerie-titre" className="border-t border-surface-border bg-surface-sunken">
      <div className="container-page py-20 sm:py-28">
        <h2 id="galerie-titre" className={cx(SECTION_LABEL_CLASS, 'text-center')}>
          Galerie
        </h2>
        <div className="mt-12 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image) => (
            <figure key={image.id} className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
              <img
                src={image.imageUrl}
                alt={image.caption ?? ''}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
              />
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
    <section id="avis" aria-labelledby="avis-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <h2 id="avis-titre" className={SECTION_LABEL_CLASS}>
            Ce qu&apos;on en dit
          </h2>
          {averageRating !== null && (
            <p className="mt-4 text-amber-500">
              {'★'.repeat(Math.round(averageRating))}
              <span className="text-surface-border">
                {'★'.repeat(5 - Math.round(averageRating))}
              </span>
              <span className="ml-2 text-sm text-ink-muted">
                {averageRating.toFixed(1)} sur 5 · {reviews.length} avis
              </span>
            </p>
          )}
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2">
          {reviews.slice(0, 6).map((review) => (
            <figure key={review.id} className="text-center sm:text-left">
              <blockquote className="font-display text-lg italic leading-relaxed">
                {review.comment ? `« ${review.comment} »` : '★'.repeat(review.rating)}
              </blockquote>
              <figcaption className="mt-3 text-xs uppercase tracking-widest text-ink-faint">
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
  location: ElegantHomeData['location'];
  openingHours: ElegantHomeData['openingHours'];
  today: number;
  isOpenNow: boolean;
  openLabel: string;
}) {
  return (
    <section
      id="localisation"
      aria-labelledby="localisation-titre"
      className="border-t border-surface-border bg-[#141110] text-white"
    >
      <div className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 id="localisation-titre" className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
            Nous trouver
          </h2>

          <p className="mt-8 flex items-center gap-2 text-sm text-white/70">
            <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', isOpenNow ? 'bg-emerald-400' : 'bg-red-400')} />
            {openLabel}
          </p>

          {(location.addressLine || location.city) && (
            <p className="mt-6 font-display text-2xl">
              {[location.addressLine, location.city, location.country].filter(Boolean).join(', ')}
            </p>
          )}

          <dl className="mt-8 space-y-4 text-sm">
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
              <a href={`tel:${location.phone}`} className="border-b border-white/40 pb-0.5 hover:border-white">
                {location.phone}
              </a>
            )}
            {location.whatsappNumber && (
              <a
                href={`https://wa.me/${location.whatsappNumber.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-white/40 pb-0.5 hover:border-white"
              >
                WhatsApp
              </a>
            )}
            {location.email && (
              <a href={`mailto:${location.email}`} className="border-b border-white/40 pb-0.5 hover:border-white">
                {location.email}
              </a>
            )}
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden">
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
              className="flex h-full min-h-[320px] w-full items-center justify-center border border-white/15 text-sm text-white/70 hover:text-white"
            >
              Voir sur la carte →
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
