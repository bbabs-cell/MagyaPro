import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { dayNames } from '@/lib/site/hours';
import { QuickAddButton } from '@/components/site/quick-add-button';
import type { HeroData, MenuCategoryData } from '@/components/site/templates';
import { getServerDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { formatDecimal } from '@/lib/numbers';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  type PopularHomeData,
  type PopularProduct,
} from '@/components/site/templates/home-parts';

/**
 * Page d'accueil dédiée au template « elegant » — une seule page qui défile,
 * à la manière des sites de restaurants gastronomiques : histoire, chef,
 * carte, galerie, avis et localisation s'enchaînent plutôt que d'être
 * dispersés sur plusieurs URL. Les autres templates gardent la structure
 * multi-pages (accueil courte + `/menu`, `/infos`…) : celle-ci est propre à
 * « elegant », qui vise justement à se démarquer des quatre autres.
 *
 * Mouvement : rare et lent, comme le reste. La couverture recule doucement,
 * le nom se révèle mot à mot, un filet se trace sous lui ; plus bas, le récit
 * s'encre à la lecture et la photo du chef glisse plus lentement que la page.
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

export async function ElegantHomePage({ data }: { data: PopularHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const hasStory = Boolean(data.story);
  const hasChef = Boolean(data.chef?.name);
  const hasGallery = data.gallery.length > 0;
  const hasReviews = data.reviewsEnabled && data.reviews.length > 0;
  const selection = data.popular.slice(0, 3);
  const hasSelection = selection.length > 0;

  type Section = { id: string; label: string };
  const sections = ([
    hasStory && { id: 'histoire', label: dict.templates.navStory },
    hasChef && { id: 'chef', label: dict.templates.navChef },
    hasSelection && { id: 'selection', label: dict.templates.sectionSelection },
    { id: 'carte', label: dict.templates.navMenu },
    hasGallery && { id: 'galerie', label: dict.templates.navGallery },
    hasReviews && { id: 'avis', label: dict.templates.navReviews },
    { id: 'localisation', label: dict.templates.navFind },
  ] as Array<Section | false>).filter((section): section is Section => Boolean(section));

  return (
    <>
      <ElegantHero data={data.hero} dict={dict} />

      {sections.length > 1 && (
        <nav
          aria-label={dict.templates.pageSections}
          className="sticky top-16 z-10 flex justify-center gap-6 overflow-x-auto border-b border-surface-border bg-surface/30 px-4 py-3 backdrop-blur-2xl backdrop-saturate-150"
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

      {hasStory && <StorySection story={data.story!} dict={dict} />}
      {hasChef && <ChefSection chef={data.chef!} dict={dict} />}
      {hasSelection && <SelectionSection products={selection} currency={data.currency} dict={dict} />}

      <MenuSection
        categories={data.menuCategories}
        currency={data.currency}
        menuHref={data.menuHref}
        dict={dict}
      />

      {hasGallery && <GallerySection images={data.gallery} dict={dict} />}
      {hasReviews && (
        <ReviewsSection reviews={data.reviews} averageRating={data.averageRating} dict={dict} locale={locale} />
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
    </>
  );
}

function ElegantHero({ data, dict }: { data: HeroData; dict: Dictionary }) {
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
            fetchPriority="high"
            decoding="async"
            className="sd-kenburns absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/70"
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
        >
          <span className="sd-rise select-none font-display text-[24rem] font-semibold leading-none text-surface-sunken sm:text-[32rem]">
            {data.name.charAt(0).toUpperCase()}
          </span>
        </span>
      )}

      <div className="container-page relative py-28 sm:py-40">
        <div className={cx('mx-auto max-w-xl text-center', hasPhoto && 'text-white')}>
          <p
            className={cx(
              'sd-rise text-xs font-semibold uppercase tracking-[0.4em]',
              hasPhoto ? 'text-white/70' : 'text-ink-faint',
            )}
          >
            {data.city ?? dict.templates.restaurant}
          </p>
          <KineticTitle text={data.name} className="mt-6 font-display text-6xl font-normal tracking-tight sm:text-7xl" />
          <span
            aria-hidden="true"
            className={cx('sd-line mx-auto mt-8 block h-px w-24', hasPhoto ? 'bg-white/50' : 'bg-ink/30')}
            style={{ '--d': '500ms' } as React.CSSProperties}
          />
          {data.description && (
            <p
              className={cx(
                'sd-rise mx-auto mt-8 max-w-md text-lg leading-relaxed',
                hasPhoto ? 'text-white/85' : 'text-ink-muted',
              )}
              style={{ '--d': '650ms' } as React.CSSProperties}
            >
              {data.description}
            </p>
          )}
          <div className="sd-rise mt-10 flex flex-col items-center gap-4" style={{ '--d': '800ms' } as React.CSSProperties}>
            <Link
              href={data.menuHref}
              className={cx(
                'inline-flex h-14 items-center rounded-none border px-10 text-sm font-medium uppercase tracking-widest transition-colors',
                hasPhoto
                  ? 'border-white text-white hover:bg-white hover:text-black'
                  : 'border-ink text-ink hover:bg-ink hover:text-surface',
              )}
            >
              {data.orderingEnabled
                ? dict.templates.ctaReserveOrOrder
                : dict.templates.ctaSeeMenu}
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

function StorySection({ story, dict }: { story: string; dict: Dictionary }) {
  return (
    <section id="histoire" aria-labelledby="histoire-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="histoire-titre" className={SECTION_LABEL_CLASS}>
            {dict.templates.sectionStory}
          </h2>
          <p className="sd-ink mx-auto mt-8 max-w-xl font-display text-2xl leading-relaxed sm:text-3xl">
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
            loading="lazy"
            className="sd-parallax absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/20"
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
            {dict.templates.sectionChef}
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
  dict,
}: {
  categories: MenuCategoryData[];
  currency: string;
  menuHref: string;
  dict: Dictionary;
}) {
  return (
    <section id="carte" aria-labelledby="carte-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <h2 id="carte-titre" className={cx(SECTION_LABEL_CLASS, 'text-center')}>
          {dict.templates.sectionMenu}
        </h2>

        {categories.length === 0 ? (
          <p className="mt-8 text-center text-ink-muted">{dict.templates.menuPreparing}</p>
        ) : (
          <div className="mx-auto mt-12 max-w-2xl space-y-14">
            {categories.map((category) => (
              <div key={category.id}>
                <h3 className="text-center font-display text-2xl">{category.name}</h3>
                <div className="mx-auto mt-6 max-w-lg divide-y divide-surface-border text-start">
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
                          // Sans photo, un monogramme dans un anneau fin plutôt
                          // qu'un disque vide : la ligne garde son rythme.
                          <span
                            aria-hidden="true"
                            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full font-display text-3xl text-ink-faint ring-1 ring-surface-border"
                          >
                            {product.name.charAt(0).toUpperCase()}
                          </span>
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
            {dict.menuPage.seeAll}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * La sélection : les trois plats les plus commandés, en portraits hauts et
 * fins, côte à côte. Le prix n'apparaît qu'à la légende, en petites
 * capitales — rien ne crie.
 */
function SelectionSection({
  products,
  currency,
  dict,
}: {
  products: PopularProduct[];
  currency: string;
  dict: Dictionary;
}) {
  return (
    <section id="selection" aria-labelledby="selection-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <h2 id="selection-titre" className={cx(SECTION_LABEL_CLASS, 'text-center')}>
          {dict.templates.sectionSelection}
        </h2>
        {/* Sur téléphone, un carrousel qu'on fait glisser du pouce : trois
            portraits empilés prendraient plusieurs écrans. */}
        <ul className="-mx-4 mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-auto sm:grid sm:max-w-5xl sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0 sm:pb-0">
          {products.map((product, index) => (
            <li
              key={product.id}
              className={cx('sd-reveal w-[68vw] max-w-[18rem] shrink-0 snap-center sm:w-auto sm:max-w-none', index === 1 && 'sm:translate-y-12')}
            >
              <Link href={product.href} className="group block text-center">
                <DishImage product={product} className="aspect-[3/4] w-full" imageClassName="duration-1000" />
                <span aria-hidden="true" className="mx-auto mt-6 block h-px w-8 bg-ink/30 transition-all duration-500 group-hover:w-16" />
                <span className="mt-5 block font-display text-2xl">{product.name}</span>
                <span className="mt-2 block text-xs uppercase tracking-[0.3em] text-ink-faint">
                  {formatMoney(product.price, currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GallerySection({
  images,
  dict,
}: {
  images: Array<{ id: string; imageUrl: string; caption: string | null }>;
  dict: Dictionary;
}) {
  return (
    <section id="galerie" aria-labelledby="galerie-titre" className="border-t border-surface-border bg-surface-sunken">
      <div className="container-page py-20 sm:py-28">
        <h2 id="galerie-titre" className={cx(SECTION_LABEL_CLASS, 'text-center')}>
          {dict.templates.sectionGallery}
        </h2>
        {/* Moins de trois photos : la grille se resserre au centre plutôt que
            de laisser une colonne vide à droite. */}
        <div className={cx('mt-12 grid grid-cols-2 gap-2', images.length >= 3 ? 'sm:grid-cols-3' : 'mx-auto max-w-4xl')}>
          {images.map((image) => (
            <figure key={image.id} className="sd-reveal overflow-hidden">
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
  dict,
  locale,
}: {
  reviews: Array<{ id: string; customerName: string; rating: number; comment: string | null }>;
  averageRating: number | null;
  dict: Dictionary;
  locale: string;
}) {
  return (
    <section id="avis" aria-labelledby="avis-titre" className="border-t border-surface-border bg-surface">
      <div className="container-page py-20 sm:py-28">
        <div className="text-center">
          <h2 id="avis-titre" className={SECTION_LABEL_CLASS}>
            {dict.templates.sectionReviews}
          </h2>
          {averageRating !== null && (
            <p className="mt-4 text-amber-500">
              {'★'.repeat(Math.round(averageRating))}
              <span className="text-surface-border">
                {'★'.repeat(5 - Math.round(averageRating))}
              </span>
              <span className="ms-2 text-sm text-ink-muted">
                {dict.templates.ratingOutOf(formatDecimal(averageRating, 1, locale), reviews.length)}
              </span>
            </p>
          )}
        </div>

        <div className={cx('mx-auto mt-12 grid gap-8', reviews.length > 1 ? 'max-w-4xl sm:grid-cols-2' : 'max-w-xl')}>
          {reviews.slice(0, 6).map((review) => (
            <figure key={review.id} className={cx('sd-reveal text-center', reviews.length > 1 && 'sm:text-start')}>
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
  dict,
  locale,
}: {
  location: ElegantHomeData['location'];
  openingHours: ElegantHomeData['openingHours'];
  today: number;
  isOpenNow: boolean;
  openLabel: string;
  dict: Dictionary;
  locale: string;
}) {
  const days = dayNames(locale);
  return (
    <section
      id="localisation"
      aria-labelledby="localisation-titre"
      className="border-t border-surface-border bg-[#141110] text-white"
    >
      <div className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 id="localisation-titre" className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
            {dict.templates.sectionFind}
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
            {weekOrder(openingHours).map((hour) => (
              <div
                key={hour.dayOfWeek}
                className={cx(
                  'flex justify-between border-b border-white/10 pb-2',
                  hour.dayOfWeek === today ? 'text-white' : 'text-white/50',
                )}
              >
                <dt>{days[hour.dayOfWeek]}</dt>
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
              title={dict.templates.mapTitle}
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
              className="group relative flex h-full min-h-[320px] w-full items-center justify-center border border-white/15 text-sm text-white/70 transition-colors hover:text-white"
              style={{
                backgroundImage: 'repeating-radial-gradient(circle at center, transparent 0 38px, rgba(255,255,255,0.07) 38px 39px)',
              }}
            >
              <span className="bg-[#141110] px-4 py-2 tracking-wide">{dict.templates.viewOnMap}</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
