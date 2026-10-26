import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { dayNames } from '@/lib/site/hours';
import { QuickAddButton } from '@/components/site/quick-add-button';
import type { MenuCategoryData } from '@/components/site/templates';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  whatsappDigits,
  type PopularHomeData,
  type PopularProduct,
} from '@/components/site/templates/home-parts';
import { getServerDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { formatDecimal } from '@/lib/numbers';

/**
 * Page d'accueil dédiée au template « prestige » — une seule page qui
 * défile, dans le registre de la haute gastronomie, filmée comme du cinéma :
 * - à l'arrivée, deux **bandes noires** s'ouvrent sur la photo, comme un
 *   écran large ; le nom se révèle mot à mot, un filet doré se trace ;
 * - les plats les plus commandés deviennent un **menu dégustation** : un
 *   service par plan large (I, II, III…), photo en parallaxe ;
 * - la galerie défile comme une **pellicule** perforée ;
 * - les avis passent un par un, comme des répliques.
 *
 * Fond sombre, accent doré : rien d'autre ne prend de couleur, pour que les
 * photos soient seules à briller.
 */

const GOLD = '#cda45e';
const BG = '#0c0b09';
const SURFACE = '#18150f';
const LINE = 'rgba(205,164,94,0.15)';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export async function PrestigeHomePage({ data }: { data: PopularHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const hasStory = Boolean(data.story);
  const hasChef = Boolean(data.chef?.name);
  const hasGallery = data.gallery.length > 0;
  const reviews = data.reviewsEnabled ? data.reviews.filter((review) => review.comment).slice(0, 6) : [];
  const courses = data.popular.slice(0, 4);

  return (
    <div style={{ backgroundColor: BG }} className="overflow-x-clip text-white">
      <PrestigeHero data={data.hero} reservationHref={data.reservationHref} dict={dict} />

      {courses.length > 0 && <TastingSection courses={courses} currency={data.currency} ordering={data.hero.orderingEnabled} dict={dict} />}
      {hasStory && <StorySection story={data.story!} dict={dict} />}
      {hasChef && <ChefSection chef={data.chef!} dict={dict} />}

      <MenuSection
        categories={data.menuCategories}
        currency={data.currency}
        menuHref={data.menuHref}
        dict={dict}
      />

      {hasGallery && <GallerySection images={data.gallery} dict={dict} />}
      {reviews.length > 0 && (
        <ReviewsSection reviews={reviews} total={data.reviews.length} averageRating={data.averageRating} dict={dict} locale={locale} />
      )}

      <LocationSection
        location={data.location}
        openingHours={data.openingHours}
        today={data.today}
        isOpenNow={data.hero.isOpenNow}
        openLabel={data.hero.openLabel}
        dict={dict}
        locale={locale}
      />

      {(data.reservationHref || data.hero.orderingEnabled) && (
        <section className="border-t py-20 text-center sm:py-28" style={{ borderColor: LINE }}>
          <div className="container-page">
            <Eyebrow>{data.hero.openLabel}</Eyebrow>
            <p className="mx-auto mt-6 max-w-2xl font-display text-4xl sm:text-6xl">{data.hero.name}</p>
            <GoldRule />
            <Link
              href={data.reservationHref ?? data.hero.menuHref}
              className="mt-10 inline-flex h-14 items-center border px-10 text-sm font-medium uppercase tracking-widest transition-colors hover:bg-[#cda45e] hover:text-black"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              {data.reservationHref ? dict.nav.reserve : dict.templates.ctaOrderNow}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function GoldRule({ animated = false, delay }: { animated?: boolean; delay?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cx('mx-auto mt-6 block h-px w-20', animated && 'sd-line')}
      style={{ backgroundColor: GOLD, '--d': delay !== undefined ? `${delay}ms` : undefined } as React.CSSProperties}
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

function PrestigeHero({
  data,
  reservationHref,
  dict,
}: {
  data: PopularHomeData['hero'];
  reservationHref: string | null;
  dict: Dictionary;
}) {
  const hasPhoto = Boolean(data.coverUrl);

  return (
    <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden">
      {hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
          <img
            src={data.coverUrl!}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="sd-kenburns absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ background: `linear-gradient(180deg, rgba(12,11,9,.6) 0%, rgba(12,11,9,.4) 40%, ${BG} 96%)` }}
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
        >
          <span className="sd-rise select-none font-display text-[24rem] font-semibold leading-none opacity-[0.05] sm:text-[32rem]">
            {data.name.charAt(0).toUpperCase()}
          </span>
        </span>
      )}

      {/* Bandes de cinéma : elles couvrent l'écran à l'arrivée et s'ouvrent
          sur la photo, puis restent en haut et en bas, fines. */}
      <span aria-hidden="true" className="sd-letterbox absolute inset-x-0 top-0 z-10 h-1/2 origin-top" style={{ backgroundColor: BG }} />
      <span aria-hidden="true" className="sd-letterbox absolute inset-x-0 bottom-0 z-10 h-1/2 origin-bottom" style={{ backgroundColor: BG }} />

      <div className="container-page relative z-20 py-32 sm:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <div className="sd-rise" style={{ '--d': '900ms' } as React.CSSProperties}>
            <Eyebrow>{data.city ?? dict.templates.fineDining}</Eyebrow>
          </div>
          <KineticTitle
            text={data.name}
            className="mt-6 font-display text-6xl font-semibold tracking-tight [&_.sd-word]:[animation-delay:calc(var(--i,0)*110ms+1000ms)] sm:text-7xl lg:text-8xl"
          />
          <GoldRule animated delay={1400} />
          {data.description && (
            <p
              className="sd-rise mx-auto mt-8 max-w-md text-lg leading-relaxed text-white/75"
              style={{ '--d': '1550ms' } as React.CSSProperties}
            >
              {data.description}
            </p>
          )}
          <div className="sd-rise mt-10 flex flex-col items-center gap-4" style={{ '--d': '1700ms' } as React.CSSProperties}>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={data.menuHref}
                className="inline-flex h-14 items-center border border-[#cda45e] bg-[#cda45e] px-10 text-sm font-medium uppercase tracking-widest text-black transition-colors hover:bg-transparent hover:text-[#cda45e]"
              >
                {data.orderingEnabled ? dict.templates.ctaOrderNow : dict.templates.ctaSeeMenu}
              </Link>
              {reservationHref && (
                <Link
                  href={reservationHref}
                  className="inline-flex h-14 items-center border border-[#cda45e] px-10 text-sm font-medium uppercase tracking-widest text-[#cda45e] transition-colors hover:bg-[#cda45e] hover:text-black"
                >
                  {dict.nav.reserve}
                </Link>
              )}
            </div>
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

/**
 * Menu dégustation : un service par plan, en écran large. La photo glisse
 * plus lentement que la page ; le numéro du service en chiffres romains.
 */
function TastingSection({
  courses,
  currency,
  ordering,
  dict,
}: {
  courses: PopularProduct[];
  currency: string;
  ordering: boolean;
  dict: Dictionary;
}) {
  return (
    <section className="border-t py-20 sm:py-28" style={{ borderColor: LINE }}>
      <div className="container-page text-center">
        <Eyebrow>{dict.templates.fineDining}</Eyebrow>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">{dict.templates.sectionSelection}</h2>
        <GoldRule />
      </div>

      <ol className="mt-16 space-y-20 sm:space-y-28">
        {courses.map((product, index) => (
          <li key={product.id} className="sd-reveal">
            <Link href={product.href} className="group block">
              <div className="mx-auto w-full max-w-6xl overflow-hidden sm:px-6">
                <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[21/9]">
                  <DishImage product={product} className="h-full w-full" imageClassName="sd-parallax" />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(0deg, ${BG} 0%, transparent 45%)` }}
                  />
                </div>
              </div>
            </Link>
            <div className="container-page -mt-16 relative text-center sm:-mt-20">
              <p className="font-display text-5xl sm:text-6xl" style={{ color: GOLD }}>
                {ROMAN[index]}
              </p>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl">
                <Link href={product.href} className="hover:underline hover:decoration-[#cda45e] hover:underline-offset-8">
                  {product.name}
                </Link>
              </h3>
              {product.description && (
                <p className="mx-auto mt-3 max-w-lg italic text-white/60">{product.description}</p>
              )}
              <p className="mt-4 flex items-center justify-center gap-5 text-sm uppercase tracking-[0.25em]">
                <span style={{ color: GOLD }}>{formatMoney(product.price, currency)}</span>
                {ordering && (
                  <QuickAddButton product={product} className="text-white/60 hover:text-white disabled:opacity-50" />
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StorySection({ story, dict }: { story: string; dict: Dictionary }) {
  return (
    <section className="border-t" style={{ borderColor: LINE }}>
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{dict.templates.sectionStory}</Eyebrow>
          <p
            className="sd-ink mx-auto mt-8 font-display text-3xl leading-relaxed sm:text-4xl"
            style={{ '--ink': '#ffffff' } as React.CSSProperties}
          >
            {story}
          </p>
        </div>
      </div>
    </section>
  );
}

function ChefSection({
  chef,
  dict,
}: {
  chef: { name: string; bio: string | null; photoUrl: string | null };
  dict: Dictionary;
}) {
  const hasPhoto = Boolean(chef.photoUrl);

  return (
    <section
      className="relative isolate flex min-h-[70vh] items-center overflow-hidden border-t"
      style={{ borderColor: LINE }}
    >
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- photo de tenant */}
          <img src={chef.photoUrl!} alt="" loading="lazy" className="sd-parallax absolute inset-0 -z-20 h-full w-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ background: `linear-gradient(0deg, ${BG} 5%, rgba(12,11,9,.55) 45%, rgba(12,11,9,.2) 100%)` }}
          />
        </>
      )}

      <div className="container-page relative py-20 sm:py-28">
        <div className="sd-reveal mx-auto max-w-lg text-center">
          <Eyebrow>{dict.templates.sectionChef}</Eyebrow>
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
  dict,
}: {
  categories: MenuCategoryData[];
  currency: string;
  menuHref: string;
  dict: Dictionary;
}) {
  return (
    <section id="carte" className="border-t" style={{ borderColor: LINE, backgroundColor: SURFACE }}>
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <Eyebrow>{dict.templates.sectionMenu}</Eyebrow>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl">{dict.templates.sectionOurMenu}</h2>
          <GoldRule />
        </div>

        {categories.length === 0 ? (
          <p className="mt-8 text-center text-white/60">{dict.templates.menuPreparing}</p>
        ) : (
          <div className="mx-auto mt-14 max-w-2xl space-y-14">
            {categories.map((category) => (
              <div key={category.id} className="sd-reveal">
                <h3 className="text-center font-display text-2xl" style={{ color: GOLD }}>
                  {category.name}
                </h3>
                <div className="mx-auto mt-6 max-w-lg text-start">
                  {category.products.map((product) => (
                    <div
                      key={product.id}
                      className={cx(
                        'flex items-center gap-5 border-t py-5 first:border-t-0',
                        !product.isAvailable && 'opacity-50',
                      )}
                      style={{ borderColor: LINE }}
                    >
                      <Link href={product.href} className="group flex min-w-0 flex-1 items-center gap-5">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                          <img
                            src={product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-20 w-20 shrink-0 rounded-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-24 sm:w-24"
                            style={{ boxShadow: `0 0 0 1px rgba(205,164,94,0.45)` }}
                          />
                        ) : (
                          // Sans photo, un monogramme doré plutôt qu'un disque vide.
                          <span
                            aria-hidden="true"
                            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full font-display text-3xl sm:h-24 sm:w-24"
                            style={{ boxShadow: `0 0 0 1px rgba(205,164,94,0.45)`, color: GOLD }}
                          >
                            {product.name.charAt(0).toUpperCase()}
                          </span>
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
            {dict.menuPage.seeAll}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Perforations d'une pellicule, en haut et en bas de la bande. */
const FILM_EDGE: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 14px, transparent 14px 28px)',
};

function GallerySection({
  images,
  dict,
}: {
  images: Array<{ id: string; imageUrl: string; caption: string | null }>;
  dict: Dictionary;
}) {
  return (
    <section className="border-t py-20 sm:py-28" style={{ borderColor: LINE }}>
      <div className="container-page text-center">
        <Eyebrow>{dict.templates.sectionGallery}</Eyebrow>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">{dict.templates.sectionAmbience}</h2>
        <GoldRule />
      </div>

      {/* Une pellicule qu'on fait défiler : chaque photo est un photogramme. */}
      <div className="mt-14 bg-black py-3">
        <div aria-hidden="true" className="h-2.5" style={FILM_EDGE} />
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[max(1rem,calc((100vw-72rem)/2))] py-3 [scrollbar-width:none]">
          {images.map((image) => (
            <li key={image.id} className="sd-snap-card w-[82vw] max-w-[42rem] shrink-0 snap-center">
              <figure className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                <img
                  src={image.imageUrl}
                  alt={image.caption ?? ''}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full object-cover"
                />
                {image.caption && (
                  <figcaption className="mt-2 text-xs uppercase tracking-[0.3em] text-white/50">{image.caption}</figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="h-2.5" style={FILM_EDGE} />
      </div>
    </section>
  );
}

function ReviewsSection({
  reviews,
  total,
  averageRating,
  dict,
  locale,
}: {
  reviews: Array<{ id: string; customerName: string; rating: number; comment: string | null }>;
  total: number;
  averageRating: number | null;
  dict: Dictionary;
  locale: string;
}) {
  return (
    <section className="border-t py-20 sm:py-28" style={{ borderColor: LINE, backgroundColor: SURFACE }}>
      <div className="container-page text-center">
        <Eyebrow>{dict.templates.sectionReviews}</Eyebrow>
        {averageRating !== null && (
          <p className="mt-4" style={{ color: GOLD }}>
            {'★'.repeat(Math.round(averageRating))}
            <span className="text-white/20">{'★'.repeat(5 - Math.round(averageRating))}</span>
            <span className="ms-2 text-sm text-white/50">
              {dict.templates.ratingOutOf(formatDecimal(averageRating, 1, locale), total)}
            </span>
          </p>
        )}
      </div>

      {/* Une réplique à la fois : on fait glisser pour la suivante. */}
      <ul className="mt-12 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {reviews.map((review) => (
          <li key={review.id} className="w-full shrink-0 snap-center px-6">
            <figure className="sd-reveal mx-auto max-w-2xl text-center">
              <span aria-hidden="true" className="block font-display text-7xl leading-[0.5]" style={{ color: GOLD }}>
                “
              </span>
              <blockquote className="mt-4 font-display text-2xl italic leading-relaxed text-white/90 sm:text-3xl">
                {review.comment}
              </blockquote>
              <figcaption className="mt-6 text-xs uppercase tracking-[0.35em] text-white/45">{review.customerName}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {reviews.length > 1 && (
        <p aria-hidden="true" className="mt-8 flex justify-center gap-2">
          {reviews.map((review) => (
            <span key={review.id} className="h-px w-6" style={{ backgroundColor: GOLD, opacity: 0.5 }} />
          ))}
        </p>
      )}
    </section>
  );
}

function LocationSection({
  location,
  openingHours,
  today,
  isOpenNow,
  openLabel,
  dict,
  locale,
}: {
  location: PopularHomeData['location'];
  openingHours: PopularHomeData['openingHours'];
  today: number;
  isOpenNow: boolean;
  openLabel: string;
  dict: Dictionary;
  locale: string;
}) {
  const days = dayNames(locale);
  const whatsapp = whatsappDigits(location.whatsappNumber);
  return (
    <section className="border-t" style={{ borderColor: LINE }}>
      <div className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <Eyebrow>{dict.templates.sectionFind}</Eyebrow>

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
            {weekOrder(openingHours).map((hour) => (
              <div
                key={hour.dayOfWeek}
                className={cx('flex justify-between border-b pb-2', hour.dayOfWeek === today ? 'text-white' : 'text-white/45')}
                style={{ borderColor: LINE }}
              >
                <dt className="capitalize">{days[hour.dayOfWeek]}</dt>
                <dd>
                  {hour.isClosed
                    ? dict.templates.closed
                    : `${hour.opensAt} – ${hour.closesAt}`}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {location.phone && (
              <a href={`tel:${location.phone}`} className="border-b pb-0.5" style={{ borderColor: GOLD, color: GOLD }}>
                {location.phone}
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
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

        <div className="relative min-h-[320px] overflow-hidden border" style={{ borderColor: LINE }}>
          {location.mapEmbedSrc ? (
            <iframe
              title={dict.templates.mapTitle}
              src={location.mapEmbedSrc}
              className="h-full min-h-[320px] w-full border-0 grayscale"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : location.mapLinkUrl ? (
            <a
              href={location.mapLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full min-h-[320px] w-full items-center justify-center text-sm text-white/70 transition-colors hover:text-white"
              style={{
                backgroundImage: 'repeating-radial-gradient(circle at center, transparent 0 38px, rgba(205,164,94,0.12) 38px 39px)',
              }}
            >
              <span className="px-4 py-2 tracking-wide" style={{ backgroundColor: BG }}>
                {dict.templates.viewOnMap}
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
