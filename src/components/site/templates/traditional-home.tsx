import Link from 'next/link';
import { ArrowRight, MapPin, Phone, Star, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';

import { formatMoney } from '@/lib/money';
import { dayNames } from '@/lib/site/hours';
import { getServerDictionary } from '@/lib/i18n/server';
import { cx } from '@/components/ui';
import { QuickAddButton } from '@/components/site/quick-add-button';
import { templateRenderer, TraditionalInfoStrip } from '@/components/site/templates';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  whatsappDigits,
  type PopularHomeData,
  type PopularProduct,
} from '@/components/site/templates/home-parts';

/**
 * Template « Traditionnel » : une page unique de bistrot, de maquis, de
 * table familiale.
 *
 * Lecture : la salle d'un restaurant de quartier qui tient depuis des années —
 * l'ardoise du jour au mur, la nappe à carreaux, les photos punaisées près de
 * la caisse, le livre d'or. Signes propres à ce template :
 * - l'**ardoise** : les plats les plus commandés écrits à la craie, cadre en
 *   bois, prix au bout des pointillés ; les horaires aussi ;
 * - la **nappe vichy**, tissée à la couleur du restaurant ;
 * - les **photos scotchées**, de travers, et les traits de craie qui se
 *   dessinent quand on arrive dessus.
 *
 * Le mouvement est sobre et chaleureux : la couverture recule doucement, le
 * nom se révèle, les lignes de l'ardoise s'écrivent l'une après l'autre.
 * Tout ce qui est affiché vient du restaurant. Rien n'est inventé.
 */

const SLATE = '#262a27';
const CHALK = '#f2efe6';
const WOOD = '#6b4a2b';

/** Grain de craie sur l'ardoise : deux trames de points très légères. */
const SLATE_TEXTURE: React.CSSProperties = {
  backgroundColor: SLATE,
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.2px), radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1.2px)',
  backgroundSize: '7px 7px, 11px 11px',
  backgroundPosition: '0 0, 3px 5px',
};

/** Nappe vichy : deux bandes croisées, à la couleur du restaurant. */
function gingham(size = 28): React.CSSProperties {
  const tint = 'color-mix(in srgb, var(--brand) 42%, transparent)';
  return {
    backgroundColor: '#fffdf8',
    backgroundImage: `linear-gradient(90deg, ${tint} 50%, transparent 50%), linear-gradient(${tint} 50%, transparent 50%)`,
    backgroundSize: `${size}px ${size}px`,
  };
}

/** Trait de craie ondulé, qui se dessine en entrant à l'écran. */
function ChalkUnderline({ className, color = CHALK }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 14" preserveAspectRatio="none" className={cx('h-3 w-40', className)}>
      <path
        d="M3 9 C 40 3, 78 13, 118 7 S 196 4, 237 9"
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        className="sd-draw"
      />
    </svg>
  );
}

/** Deux morceaux de scotch posés en travers des coins. */
function Tape() {
  return (
    <>
      <span aria-hidden="true" className="absolute -left-3 -top-2 h-6 w-16 -rotate-[28deg] bg-[#f6e7b8]/80 shadow-sm" />
      <span aria-hidden="true" className="absolute -right-3 -top-2 h-6 w-16 rotate-[28deg] bg-[#f6e7b8]/80 shadow-sm" />
    </>
  );
}

/** Photo punaisée : cadre blanc, scotch, légende manuscrite. */
function TapedPhoto({
  product,
  tilt,
  className,
}: {
  product: PopularProduct;
  tilt: number;
  className?: string;
}) {
  return (
    <Link
      href={product.href}
      className={cx('group relative block bg-white p-3 pb-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:rotate-0', className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <Tape />
      <DishImage product={product} className="aspect-square w-full" />
      <span className="mt-3 block truncate text-center font-display text-lg italic text-[#2b2620]">{product.name}</span>
    </Link>
  );
}

export async function TraditionalHomePage({ data }: { data: PopularHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const t = dict.templates;
  const { Menu } = templateRenderer('traditional');
  const hero = data.hero;
  const days = dayNames(locale);
  const board = data.popular.slice(0, 6);
  const whatsapp = whatsappDigits(data.location.whatsappNumber);
  const reviews = data.reviewsEnabled ? data.reviews.filter((review) => review.comment).slice(0, 6) : [];

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ Héros */}
      <section className="relative isolate overflow-hidden bg-[#1c1712]">
        <div className="relative min-h-[34rem] w-full sm:min-h-[40rem] lg:h-[min(46rem,calc(100dvh-7rem))]">
          {hero.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire
            <img
              src={hero.coverUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="sd-kenburns absolute inset-0 -z-20 h-full w-full object-cover"
            />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-30" style={gingham(44)} />
          )}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

          <div className="container-page flex min-h-[inherit] flex-col justify-end pb-14 pt-24 text-white sm:pb-20 lg:h-full">
            <p className="sd-rise text-sm font-medium uppercase tracking-[0.3em] text-white/75">
              {hero.city ?? t.welcome}
            </p>
            <KineticTitle
              text={hero.name}
              className="mt-4 max-w-4xl font-display text-[3.25rem] font-semibold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl"
            />
            <ChalkUnderline className="sd-rise mt-4 w-48 sm:w-64" />
            {hero.description && (
              <p
                className="sd-rise mt-6 max-w-xl text-lg text-white/85"
                style={{ '--d': '450ms' } as React.CSSProperties}
              >
                {hero.description}
              </p>
            )}
            <div className="sd-rise mt-9 flex flex-wrap gap-3" style={{ '--d': '600ms' } as React.CSSProperties}>
              <Link
                href={hero.menuHref}
                className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-8 font-semibold text-[#1c1712] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {hero.orderingEnabled ? t.ctaSeeMenuAndOrder : t.ctaSeeMenu}
                <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href={data.reservationHref ?? hero.infosHref}
                className="inline-flex h-14 items-center rounded-full border border-white/50 px-8 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                {data.reservationHref ? dict.nav.reserve : t.sectionFind}
              </Link>
            </div>
          </div>
        </div>
        <TraditionalInfoStrip data={hero} />
      </section>

      <div aria-hidden="true" className="h-5 border-b border-black/10 sm:h-6" style={gingham(20)} />

      {/* ---------------------------------------------------------- Ardoise
          Les plus commandés, écrits à la craie ; à côté, les deux premiers
          en photo punaisée. */}
      {board.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-page grid items-center gap-14 lg:grid-cols-[1.3fr_0.7fr]">
            <div
              className="sd-reveal rounded-2xl p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] sm:p-10"
              style={{ ...SLATE_TEXTURE, border: `12px solid ${WOOD}`, color: CHALK }}
            >
              <h2 className="text-center font-display text-4xl italic sm:text-5xl">{t.boardTitle}</h2>
              <ChalkUnderline className="mx-auto mt-3 w-44 sm:w-56" />

              <ul className="mt-10 space-y-6">
                {board.map((product, index) => (
                  <li
                    key={product.id}
                    className="sd-rise"
                    style={{ '--d': `${200 + index * 120}ms` } as React.CSSProperties}
                  >
                    <div className="flex items-baseline gap-3">
                      <Link href={product.href} className="font-display text-xl hover:underline hover:underline-offset-4 sm:text-2xl">
                        {product.name}
                      </Link>
                      <span aria-hidden="true" className="mb-1.5 min-w-6 flex-1 border-b-2 border-dotted" style={{ borderColor: `${CHALK}55` }} />
                      <span className="shrink-0 font-display text-xl tabular-nums sm:text-2xl">
                        {formatMoney(product.price, data.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4 text-sm" style={{ color: `${CHALK}99` }}>
                      <span className="min-w-0 truncate italic">
                        {product.orderedCount > 0 ? t.orderedTimes(product.orderedCount) : product.categoryName}
                      </span>
                      {hero.orderingEnabled && (
                        <QuickAddButton
                          product={product}
                          className="shrink-0 font-semibold underline decoration-dashed underline-offset-4 hover:text-white disabled:opacity-50"
                          style={{ color: CHALK }}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto hidden h-[28rem] w-full max-w-[22rem] sm:block">
              {board[1] && <TapedPhoto product={board[1]} tilt={-6} className="absolute left-0 top-0 w-[72%]" />}
              <TapedPhoto product={board[0]!} tilt={4} className="absolute bottom-0 right-0 w-[78%]" />
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Carte */}
      <section id="carte" className="border-t border-surface-border bg-surface-sunken/60 py-16 sm:py-24">
        <div className="container-page">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.sectionOurMenu}</h2>
          <ChalkUnderline className="mt-2 w-44" color="var(--brand)" />
          <div className="sd-reveal mt-10">
            <Menu categories={data.menuCategories} currency={data.currency} />
          </div>
          <div className="mt-12 flex justify-center">
            <Link
              href={data.menuHref}
              className="group inline-flex h-14 items-center gap-2.5 rounded-full px-8 font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Histoire, chef */}
      {(data.story || data.chef) && (
        <section className="py-16 sm:py-24">
          <div
            className={cx(
              'container-page grid gap-14 lg:items-center',
              data.story && data.chef ? 'lg:grid-cols-[1.3fr_0.7fr]' : 'max-w-4xl',
            )}
          >
            {data.story && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em]" style={{ color: 'var(--brand)' }}>
                  {t.sectionStory}
                </h2>
                <p className="sd-ink mt-5 font-display text-3xl italic leading-[1.3] sm:text-4xl">{data.story}</p>
              </div>
            )}
            {data.chef && (
              <figure className="sd-reveal relative mx-auto w-full max-w-[17rem] rotate-2 bg-white p-3 pb-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]">
                <Tape />
                {data.chef.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                  <img src={data.chef.photoUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex aspect-square w-full items-center justify-center font-display text-7xl"
                    style={{ ...SLATE_TEXTURE, color: CHALK }}
                  >
                    {data.chef.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <figcaption className="mt-3 text-center text-[#2b2620]">
                  <span className="block text-xs uppercase tracking-[0.25em] text-[#2b2620]/60">{t.sectionChef}</span>
                  <span className="block font-display text-xl italic">{data.chef.name}</span>
                  {data.chef.bio && <span className="mt-1 block text-sm text-[#2b2620]/70">{data.chef.bio}</span>}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Galerie
          Des photos scotchées au mur, chacune un peu de travers. */}
      {data.gallery.length > 0 && (
        <section className={cx('pb-16 sm:pb-24', !(data.story || data.chef) && 'pt-16 sm:pt-24')}>
          <div className="container-page">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.sectionAmbience}</h2>
            <ChalkUnderline className="mt-2 w-40" color="var(--brand)" />
            <div
              className={cx(
                'mt-12 grid grid-cols-2 gap-6 sm:gap-10',
                data.gallery.length >= 3 ? 'sm:grid-cols-3' : 'mx-auto max-w-3xl',
              )}
            >
              {data.gallery.slice(0, 6).map((image, index) => (
                <figure
                  key={image.id}
                  className="sd-reveal relative bg-white p-2.5 pb-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:rotate-0"
                  style={{ transform: `rotate(${[-3, 2, -1.5][index % 3]}deg)` }}
                >
                  <Tape />
                  {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                  <img
                    src={image.imageUrl}
                    alt={image.caption ?? ''}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/5] w-full object-cover"
                  />
                  {image.caption && (
                    <figcaption className="mt-2 truncate text-center font-display text-sm italic text-[#2b2620]">
                      {image.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- Livre d'or
          Les avis sur des pages lignées, marge rouge comprise. */}
      {reviews.length > 0 && (
        <section className="border-t border-surface-border bg-surface-sunken/60 py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.sectionTheyTalk}</h2>
                <ChalkUnderline className="mt-2 w-40" color="var(--brand)" />
              </div>
              {data.averageRating !== null && (
                <p className="flex items-center gap-2 font-semibold">
                  <Star weight="fill" className="h-5 w-5 text-amber-500" />
                  {t.ratingOutOf(data.averageRating.toFixed(1).replace('.', ','), data.reviews.length)}
                </p>
              )}
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, index) => (
                <li
                  key={review.id}
                  className="sd-reveal relative overflow-hidden rounded-sm py-6 pe-6 ps-12 text-[#2b2620] shadow-[0_14px_30px_-18px_rgba(0,0,0,0.4)]"
                  style={{
                    transform: `rotate(${index % 2 === 0 ? -0.8 : 0.8}deg)`,
                    backgroundColor: '#fffdf6',
                    backgroundImage:
                      'linear-gradient(90deg, transparent 2.1rem, rgba(220,60,60,0.5) 2.1rem, rgba(220,60,60,0.5) calc(2.1rem + 1px), transparent calc(2.1rem + 1px)), repeating-linear-gradient(transparent 0 1.7rem, rgba(70,110,170,0.18) 1.7rem calc(1.7rem + 1px))',
                  }}
                >
                  <p className="flex gap-0.5" aria-label={t.ratingSimple(String(review.rating))}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        weight="fill"
                        aria-hidden="true"
                        className={cx('h-4 w-4', i < review.rating ? 'text-amber-500' : 'text-black/10')}
                      />
                    ))}
                  </p>
                  <blockquote className="mt-3 line-clamp-5 font-display text-lg italic leading-[1.7rem]">
                    « {review.comment} »
                  </blockquote>
                  <p className="mt-3 text-end text-sm font-semibold">— {review.customerName}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Nous trouver
          Les horaires à la craie, sur une seconde ardoise. */}
      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div
            className="sd-reveal rounded-2xl p-6 sm:p-9"
            style={{ ...SLATE_TEXTURE, border: `10px solid ${WOOD}`, color: CHALK }}
          >
            <h2 className="font-display text-3xl italic">{t.sectionHours}</h2>
            <ChalkUnderline className="mt-2 w-40" />
            {data.openingHours.length > 0 ? (
              <dl className="mt-6 space-y-2.5">
                {weekOrder(data.openingHours).map((hour) => {
                  const isToday = hour.dayOfWeek === data.today;
                  return (
                    <div key={hour.dayOfWeek} className={cx('flex items-baseline gap-3', !isToday && 'opacity-70')}>
                      <dt className={cx('capitalize', isToday && 'font-semibold')}>
                        {days[hour.dayOfWeek]}
                        {isToday && <span className="ms-2 text-xs italic">({t.today})</span>}
                      </dt>
                      <span aria-hidden="true" className="flex-1 border-b border-dotted" style={{ borderColor: `${CHALK}40` }} />
                      <dd className="tabular-nums">{hour.isClosed ? t.closed : `${hour.opensAt} - ${hour.closesAt}`}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-6 opacity-70">{t.hoursUnknown}</p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {data.location.phone && (
                <a
                  href={`tel:${data.location.phone}`}
                  className="inline-flex h-12 items-center gap-2 rounded-full border px-5 font-semibold transition-colors hover:bg-white/10"
                  style={{ borderColor: `${CHALK}80` }}
                >
                  <Phone weight="bold" className="h-5 w-5" />
                  {t.ctaCall}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1f9d55] px-5 font-semibold text-white transition-transform hover:-translate-y-0.5"
                >
                  <WhatsappLogo weight="fill" className="h-5 w-5" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="sd-reveal relative min-h-[18rem] overflow-hidden rounded-2xl border border-surface-border bg-[#f3eadb]">
            {data.location.mapEmbedSrc ? (
              <iframe title={t.mapTitle} src={data.location.mapEmbedSrc} loading="lazy" className="absolute inset-0 h-full w-full" />
            ) : (
              // Sans carte : un coin de nappe, très pâle, et une épingle.
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 opacity-25" style={gingham(36)} />
                <MapPin weight="fill" className="sd-float relative mb-16 h-16 w-16 drop-shadow-lg" style={{ color: 'var(--brand)' }} />
              </div>
            )}
            <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-xl bg-white p-4 text-[#2b2620] shadow-lg">
              <MapPin weight="fill" className="mt-0.5 h-6 w-6 shrink-0" style={{ color: 'var(--brand)' }} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {[data.location.addressLine, data.location.city].filter(Boolean).join(', ') || hero.name}
                </p>
                {data.location.mapLinkUrl && (
                  <a href={data.location.mapLinkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline underline-offset-4">
                    {t.viewOnMap}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Appel final
          Une carte de menu posée sur la nappe. */}
      {hero.orderingEnabled && (
        <section className="px-4 py-16 sm:py-24" style={gingham(32)}>
          <div className="sd-reveal mx-auto max-w-xl bg-[#fffdf8] px-6 py-12 text-center text-[#2b2620] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:px-12">
            <p className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{hero.name}</p>
            <ChalkUnderline className="mx-auto mt-3 w-40" color="var(--brand)" />
            <p className="mt-4 text-[#2b2620]/70">{hero.openLabel}</p>
            <Link
              href={hero.menuHref}
              className="group mt-8 inline-flex h-14 items-center gap-2.5 rounded-full px-8 font-semibold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {t.ctaOrderNow}
              <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
