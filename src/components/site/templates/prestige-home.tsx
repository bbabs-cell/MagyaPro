import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { DAY_NAMES } from '@/lib/site/hours';
import { QuickAddButton } from '@/components/site/quick-add-button';
import type { ElegantHomeData } from '@/components/site/templates/elegant-home';
import type { MenuCategoryData } from '@/components/site/templates';

/**
 * Page d'accueil dédiée au template « prestige » — une seule page qui
 * défile, dans le registre de la haute gastronomie : fond sombre, accent
 * doré, grandes photos pleine largeur. Réutilise la même forme de données
 * que « elegant » (`ElegantHomeData`) — seule l'identité visuelle change.
 */

const GOLD = '#cda45e';
const BG = '#0c0b09';
const SURFACE = '#18150f';

export function PrestigeHomePage({ data }: { data: ElegantHomeData }) {
  const hasStory = Boolean(data.story);
  const hasChef = Boolean(data.chef?.name);
  const hasGallery = data.gallery.length > 0;
  const hasReviews = data.reviewsEnabled && data.reviews.length > 0;

  return (
    <div style={{ backgroundColor: BG }} className="text-white">
      <PrestigeHero data={data.hero} />

      {hasStory && <StorySection story={data.story!} />}
      {hasChef && <ChefSection chef={data.chef!} />}

      <MenuSection categories={data.menuCategories} currency={data.currency} menuHref={data.menuHref} />

      {hasGallery && <GallerySection images={data.gallery} />}
      {hasReviews && <ReviewsSection reviews={data.reviews} averageRating={data.averageRating} />}

      <LocationSection
        location={data.location}
        openingHours={data.openingHours}
        today={data.today}
        isOpenNow={data.hero.isOpenNow}
        openLabel={data.hero.openLabel}
      />
    </div>
  );
}

function GoldRule() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto mt-6 block h-px w-16"
      style={{ backgroundColor: GOLD }}
    />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.4em]" style={{ color: GOLD }}>
      {children}
    </p>
  );
}

function PrestigeHero({ data }: { data: ElegantHomeData['hero'] }) {
  const hasPhoto = Boolean(data.coverUrl);

  return (
    <section className="relative isolate flex min-h-[90vh] items-center overflow-hidden">
      {hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
          <img src={data.coverUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, rgba(12,11,9,.65) 0%, rgba(12,11,9,.45) 40%, ${BG} 92%)` }}
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[24rem] font-semibold leading-none opacity-[0.05] sm:text-[32rem]"
        >
          {data.name.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="container-page relative py-28 sm:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>{data.city ?? 'Restaurant gastronomique'}</Eyebrow>
          <h1 className="mt-6 font-display text-6xl font-semibold tracking-tight sm:text-7xl">
            {data.name}
          </h1>
          <GoldRule />
          {data.description && (
            <p className="mx-auto mt-8 max-w-md text-lg leading-relaxed text-white/75">
              {data.description}
            </p>
          )}
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href={data.menuHref}
              className="inline-flex h-14 items-center border border-[#cda45e] px-10 text-sm font-medium uppercase tracking-widest text-[#cda45e] transition-colors hover:bg-[#cda45e] hover:text-black"
            >
              {data.orderingEnabled ? 'Réserver ou commander' : 'Voir le menu'}
            </Link>
            <p className="flex items-center gap-2 text-xs text-white/60">
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
    <section className="border-t" style={{ borderColor: 'rgba(205,164,94,0.15)' }}>
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Notre histoire</Eyebrow>
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
      className="relative isolate flex min-h-[65vh] items-center overflow-hidden border-t"
      style={{ borderColor: 'rgba(205,164,94,0.15)' }}
    >
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- photo de tenant */}
          <img src={chef.photoUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: `linear-gradient(0deg, ${BG} 5%, rgba(12,11,9,.55) 45%, rgba(12,11,9,.2) 100%)` }}
          />
        </>
      )}

      <div className="container-page relative py-20 sm:py-28">
        <div className="mx-auto max-w-lg text-center">
          <Eyebrow>Le chef</Eyebrow>
          {!hasPhoto && (
            <span
              aria-hidden="true"
              className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full font-display text-4xl"
              style={{ backgroundColor: SURFACE, border: `1px solid ${GOLD}` }}
            >
              {chef.name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="mt-4 font-display text-4xl">{chef.name}</p>
          {chef.bio && <p className="mx-auto mt-4 max-w-md leading-relaxed text-white/75">{chef.bio}</p>}
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
    <section className="border-t" style={{ borderColor: 'rgba(205,164,94,0.15)' }}>
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <Eyebrow>La carte</Eyebrow>
          <h2 className="mt-3 font-display text-4xl">Notre sélection</h2>
        </div>

        {categories.length === 0 ? (
          <p className="mt-8 text-center text-white/60">La carte est en préparation.</p>
        ) : (
          <div className="mx-auto mt-14 max-w-2xl space-y-14">
            {categories.map((category) => (
              <div key={category.id}>
                <h3 className="text-center font-display text-2xl" style={{ color: GOLD }}>
                  {category.name}
                </h3>
                <div className="mx-auto mt-6 max-w-lg divide-y text-left" style={{ borderColor: 'rgba(205,164,94,0.15)' }}>
                  {category.products.map((product) => (
                    <div
                      key={product.id}
                      className={cx(
                        'flex items-center gap-5 border-t py-5 first:border-t-0',
                        !product.isAvailable && 'opacity-50',
                      )}
                      style={{ borderColor: 'rgba(205,164,94,0.15)' }}
                    >
                      <Link href={product.href} className="flex min-w-0 flex-1 items-center gap-5">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                          <img
                            src={product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-24 w-24 shrink-0 rounded-full object-cover"
                            style={{ boxShadow: '0 0 0 1px rgba(205,164,94,0.35)' }}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-24 w-24 shrink-0 rounded-full"
                            style={{ backgroundColor: SURFACE }}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="font-display text-xl">{product.name}</span>
                          {product.description && (
                            <span className="mt-1.5 block text-sm italic text-white/60">
                              {product.description}
                            </span>
                          )}
                        </span>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm tracking-wide" style={{ color: GOLD }}>
                          {formatMoney(product.price, currency)}
                        </span>
                        <QuickAddButton
                          product={product}
                          className="text-xs uppercase tracking-widest text-white/50 hover:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-14 text-center">
          <Link
            href={menuHref}
            className="inline-flex h-12 items-center border-b text-sm font-medium uppercase tracking-widest"
            style={{ borderColor: GOLD, color: GOLD }}
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
    <section className="border-t" style={{ borderColor: 'rgba(205,164,94,0.15)', backgroundColor: SURFACE }}>
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <Eyebrow>Galerie</Eyebrow>
          <h2 className="mt-3 font-display text-4xl">L&apos;ambiance</h2>
        </div>
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
    <section className="border-t" style={{ borderColor: 'rgba(205,164,94,0.15)' }}>
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <Eyebrow>Ce qu&apos;on en dit</Eyebrow>
          {averageRating !== null && (
            <p className="mt-4" style={{ color: GOLD }}>
              {'★'.repeat(Math.round(averageRating))}
              <span className="text-white/20">{'★'.repeat(5 - Math.round(averageRating))}</span>
              <span className="ml-2 text-sm text-white/50">
                {averageRating.toFixed(1)} sur 5 · {reviews.length} avis
              </span>
            </p>
          )}
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2">
          {reviews.slice(0, 6).map((review) => (
            <figure key={review.id} className="text-center sm:text-left">
              <blockquote className="font-display text-lg italic leading-relaxed text-white/85">
                {review.comment ? `« ${review.comment} »` : '★'.repeat(review.rating)}
              </blockquote>
              <figcaption className="mt-3 text-xs uppercase tracking-widest text-white/40">
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
    <section className="border-t" style={{ borderColor: 'rgba(205,164,94,0.15)', backgroundColor: SURFACE }}>
      <div className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <Eyebrow>Nous trouver</Eyebrow>

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
                className={cx('flex justify-between border-b pb-2', hour.dayOfWeek === today ? 'text-white' : 'text-white/45')}
                style={{ borderColor: 'rgba(205,164,94,0.15)' }}
              >
                <dt>{DAY_NAMES[hour.dayOfWeek]}</dt>
                <dd>{hour.isClosed ? 'Fermé' : `${hour.opensAt} – ${hour.closesAt}`}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {location.phone && (
              <a href={`tel:${location.phone}`} className="border-b pb-0.5" style={{ borderColor: GOLD, color: GOLD }}>
                {location.phone}
              </a>
            )}
            {location.whatsappNumber && (
              <a
                href={`https://wa.me/${location.whatsappNumber.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b pb-0.5"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                WhatsApp
              </a>
            )}
            {location.email && (
              <a href={`mailto:${location.email}`} className="border-b pb-0.5" style={{ borderColor: GOLD, color: GOLD }}>
                {location.email}
              </a>
            )}
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden border" style={{ borderColor: 'rgba(205,164,94,0.15)' }}>
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
