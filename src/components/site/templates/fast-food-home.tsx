import Link from 'next/link';
import { ArrowRight, Clock, Fire, MapPin, Phone, Star, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';

import { formatMoney } from '@/lib/money';
import { dayNames } from '@/lib/site/hours';
import { getServerDictionary } from '@/lib/i18n/server';
import { cx } from '@/components/ui';
import { QuickAddButton } from '@/components/site/quick-add-button';
import { templateRenderer } from '@/components/site/templates';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  whatsappDigits,
  type PopularHomeData,
} from '@/components/site/templates/home-parts';

/**
 * Template « Fast-food » : une page unique, néo-brutaliste, qui donne faim
 * tout de suite.
 *
 * Lecture : l'enseigne d'un comptoir de burgers — capitales noires, aplats de
 * la couleur du restaurant, contours épais et ombres décalées comme des
 * autocollants collés à la main. Signes propres à ce template :
 * - le **plat vedette** (le plus commandé) posé sur un macaron en étoile qui
 *   tourne lentement, son prix sur une seconde étoile ;
 * - des **autocollants** (badges, rangs, prix) qui se collent d'un coup à
 *   l'ouverture, avec un rebond ;
 * - deux **bandeaux croisés** qui défilent en sens inverse.
 *
 * Le mouvement est vif mais bref : il accroche, puis il laisse lire.
 * Tout ce qui est affiché vient du restaurant. Rien n'est inventé.
 */

const INK = '#111111';
const YELLOW = '#ffd23f';
const STICKER_SHADOW = 'shadow-[4px_4px_0_#111]';
const BLOCK_SHADOW = 'shadow-[8px_8px_0_#111]';

/** Polygone d'étoile à `points` branches, pour les macarons. */
function starPoints(points: number, outer = 50, inner = 42): string {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

function Burst({ className, fill, spin = false }: { className?: string; fill: string; spin?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={cx(spin && 'sd-spin', className)}>
      <polygon points={starPoints(18)} fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Un bandeau qui défile ; `reverse` le fait aller dans l'autre sens. */
function Ticker({
  items,
  className,
  style,
  reverse = false,
}: {
  items: string[];
  className?: string;
  style?: React.CSSProperties;
  reverse?: boolean;
}) {
  const repeated = [...items, ...items, ...items, ...items];
  return (
    <div className={cx('overflow-hidden border-y-[3px] border-[#111] py-3', className)} style={style}>
      <div
        className="marquee-track flex w-max gap-8 whitespace-nowrap"
        style={{ animationDuration: '30s', animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        {repeated.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-8 text-xl font-black uppercase tracking-tight sm:text-2xl"
            aria-hidden={index >= items.length || undefined}
          >
            {item}
            <Star weight="fill" className="h-5 w-5" />
          </span>
        ))}
      </div>
    </div>
  );
}

export async function FastFoodHomePage({ data }: { data: PopularHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const t = dict.templates;
  const { Menu } = templateRenderer('fast-food');
  const hero = data.hero;
  const days = dayNames(locale);
  const star = data.popular[0] ?? null;
  const whatsapp = whatsappDigits(data.location.whatsappNumber);
  const reviews = data.reviewsEnabled ? data.reviews.filter((review) => review.comment).slice(0, 8) : [];
  const categoryNames = data.menuCategories.map((category) => category.name);
  const dishNames = data.popular.map((product) => product.name);

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ Héros */}
      <section className="relative isolate overflow-hidden text-white" style={{ backgroundColor: 'var(--brand)' }}>
        {/* Trame de points : la texture d'une affiche imprimée. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.16]"
          style={{ backgroundImage: 'radial-gradient(circle, #000 1.3px, transparent 1.6px)', backgroundSize: '14px 14px' }}
        />

        <div className="container-page grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:min-h-[min(44rem,calc(100dvh-4rem))] lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div>
            <p
              className={cx('sd-pop inline-flex items-center gap-2 rounded-full border-[3px] border-[#111] bg-white px-4 py-1.5 text-sm font-black uppercase text-[#111]', STICKER_SHADOW)}
              style={{ '--sd-tilt': '-2deg', '--d': '0ms' } as React.CSSProperties}
            >
              <span
                aria-hidden="true"
                className={cx('h-2.5 w-2.5 rounded-full', hero.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
              />
              {hero.openLabel}
            </p>

            <KineticTitle
              text={hero.name}
              className="mt-7 text-[3.6rem] font-black uppercase leading-[0.88] tracking-[-0.03em] [text-shadow:5px_5px_0_#111] sm:text-8xl lg:text-[7.5rem]"
            />

            {hero.description && (
              <p
                className="sd-rise mt-7 max-w-lg text-lg font-semibold text-white/90"
                style={{ '--d': '400ms' } as React.CSSProperties}
              >
                {hero.description}
              </p>
            )}

            <div className="sd-rise mt-9 flex flex-wrap items-center gap-4" style={{ '--d': '520ms' } as React.CSSProperties}>
              <Link
                href={hero.menuHref}
                className={cx(
                  'group inline-flex h-16 items-center gap-3 rounded-2xl border-[3px] border-[#111] bg-[#111] px-8 text-lg font-black uppercase text-white transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none',
                  'shadow-[6px_6px_0_#fff]',
                )}
              >
                {hero.orderingEnabled ? t.ctaOrderNow : t.ctaSeeMenu}
                <ArrowRight weight="bold" className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href={hero.infosHref}
                className="inline-flex h-16 items-center rounded-2xl border-[3px] border-white px-6 font-black uppercase transition-colors hover:bg-white hover:text-[#111]"
              >
                {t.sectionFind}
              </Link>
            </div>
          </div>

          {/* Le plat vedette sur son macaron. Sans plat, la photo de couverture. */}
          {star ? (
            <Link href={star.href} className="group relative mx-auto block aspect-square w-full max-w-[30rem]">
              <Burst fill={YELLOW} spin className="absolute inset-0 h-full w-full drop-shadow-[8px_8px_0_#111]" />
              <div
                className="sd-rise absolute inset-[13%] overflow-hidden rounded-full border-[4px] border-[#111]"
                style={{ '--d': '200ms' } as React.CSSProperties}
              >
                <DishImage product={star} className="h-full w-full" priority />
              </div>

              {/* Prix sur une étoile, qui se colle en dernier. */}
              <span
                className="sd-pop absolute -right-1 top-[4%] flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36"
                style={{ '--sd-tilt': '12deg', '--d': '700ms' } as React.CSSProperties}
              >
                <Burst fill="#ffffff" className="absolute inset-0 h-full w-full" />
                <span className="relative max-w-[68%] text-center text-base font-black leading-none text-[#111] sm:text-lg">
                  {formatMoney(star.price, data.currency)}
                </span>
              </span>

              <span
                className={cx('sd-pop absolute bottom-[4%] left-0 max-w-[80%] rounded-2xl border-[3px] border-[#111] bg-white px-4 py-2 text-[#111]', STICKER_SHADOW)}
                style={{ '--sd-tilt': '-4deg', '--d': '850ms' } as React.CSSProperties}
              >
                <span className="flex items-center gap-1.5 text-xs font-black uppercase" style={{ color: 'var(--brand)' }}>
                  <Fire weight="fill" className="h-4 w-4" />
                  {t.badgePopular}
                </span>
                <span className="block truncate text-lg font-black uppercase leading-tight">{star.name}</span>
              </span>
            </Link>
          ) : hero.coverUrl ? (
            <div className={cx('sd-rise overflow-hidden rounded-[2rem] border-[4px] border-[#111]', BLOCK_SHADOW)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire */}
              <img src={hero.coverUrl} alt="" fetchPriority="high" decoding="async" className="aspect-[4/3] w-full object-cover" />
            </div>
          ) : null}
        </div>
      </section>

      {/* -------------------------------------------- Bandeaux croisés
          Deux rubans en sens inverse, inclinés en X : l'image la plus
          « comptoir » de la page. */}
      {(dishNames.length > 0 || categoryNames.length > 0) && (
        <div className="relative z-10 -my-4 py-14 sm:py-16" aria-hidden="true">
          <Ticker
            items={dishNames.length > 0 ? dishNames : categoryNames}
            className="-rotate-3 scale-110"
            style={{ backgroundColor: YELLOW, color: INK }}
          />
          <Ticker
            items={categoryNames.length > 0 ? categoryNames : dishNames}
            reverse
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-3 scale-110 bg-[#111] text-white"
          />
        </div>
      )}

      {/* --------------------------------------------- Les plus commandés
          Des cartes-autocollants légèrement de travers, qui se redressent
          sous le doigt ou la souris. */}
      {data.popular.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
                {t.sectionMostOrdered}
              </h2>
              <Link
                href={data.menuHref}
                className="group inline-flex items-center gap-2 font-black uppercase underline decoration-[3px] underline-offset-4"
              >
                {dict.menuPage.seeAll}
                <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {data.popular.map((product, index) => (
                <li
                  key={product.id}
                  className="sd-reveal"
                >
                  <div
                    className={cx(
                      'group relative rounded-[1.75rem] border-[3px] border-[#111] bg-surface transition-transform duration-300 hover:rotate-0 hover:-translate-y-1',
                      BLOCK_SHADOW,
                      ['-rotate-1', 'rotate-1', '-rotate-[0.5deg]'][index % 3],
                    )}
                  >
                    <Link href={product.href} className="block">
                      <DishImage
                        product={product}
                        className="aspect-[4/3] rounded-t-[1.5rem] border-b-[3px] border-[#111]"
                      />
                      <span
                        className={cx(
                          'absolute -left-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#111] text-2xl font-black text-[#111]',
                          STICKER_SHADOW,
                        )}
                        style={{ backgroundColor: YELLOW }}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={cx(
                          'absolute right-4 top-4 rotate-3 rounded-full border-[3px] border-[#111] bg-white px-3 py-1 text-sm font-black text-[#111]',
                          STICKER_SHADOW,
                        )}
                      >
                        {formatMoney(product.price, data.currency)}
                      </span>
                      <div className="p-5 pb-3">
                        <h3 className="text-xl font-black uppercase leading-tight">{product.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-ink-muted">
                          {product.orderedCount > 0 ? t.orderedTimes(product.orderedCount) : product.categoryName}
                        </p>
                      </div>
                    </Link>
                    {hero.orderingEnabled && (
                      <div className="px-5 pb-5">
                        <QuickAddButton
                          product={product}
                          className="flex h-12 w-full items-center justify-center rounded-xl border-[3px] border-[#111] text-sm font-black uppercase text-white transition-transform active:translate-y-0.5 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--brand)' }}
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Carte */}
      <section id="carte" className="border-y-[3px] border-[#111] py-16 sm:py-24" style={{ backgroundColor: YELLOW, color: INK }}>
        <div className="container-page">
          <h2 className="inline-block -rotate-2 rounded-2xl border-[3px] border-[#111] bg-white px-5 py-2 text-4xl font-black uppercase tracking-tight shadow-[6px_6px_0_#111] sm:text-6xl">
            {t.sectionOurMenu}
          </h2>
          <div className="sd-reveal mt-12">
            <Menu categories={data.menuCategories} currency={data.currency} />
          </div>
          <div className="mt-12 flex justify-center">
            <Link
              href={data.menuHref}
              className="group inline-flex h-16 items-center gap-3 rounded-2xl border-[3px] border-[#111] bg-[#111] px-8 text-lg font-black uppercase text-white shadow-[6px_6px_0_#fff] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-6 w-6 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Histoire */}
      {(data.story || data.chef) && (
        <section className="py-16 sm:py-24">
          <div className="container-page grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            {data.story && (
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--brand)' }}>
                  {t.sectionStory}
                </h2>
                <p className="sd-ink mt-4 text-3xl font-black uppercase leading-[1.1] tracking-tight sm:text-5xl">
                  {data.story}
                </p>
              </div>
            )}
            {data.chef && (
              <figure
                className={cx('sd-reveal rotate-2 rounded-[1.75rem] border-[3px] border-[#111] bg-surface p-4', BLOCK_SHADOW)}
              >
                {data.chef.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                  <img
                    src={data.chef.photoUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-2xl border-[3px] border-[#111] object-cover"
                  />
                )}
                <figcaption className="mt-4 px-1">
                  <p className="text-xs font-black uppercase" style={{ color: 'var(--brand)' }}>
                    {t.sectionKitchen}
                  </p>
                  <p className="text-2xl font-black uppercase">{data.chef.name}</p>
                  {data.chef.bio && <p className="mt-1 text-sm text-ink-muted">{data.chef.bio}</p>}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Galerie
          Des photos-polaroïds collées de travers. */}
      {data.gallery.length > 0 && (
        <section className={cx('pb-16 sm:pb-24', !(data.story || data.chef) && 'pt-16 sm:pt-24')}>
          <div className="container-page">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-6xl">{t.sectionInKitchen}</h2>
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8">
              {data.gallery.slice(0, 6).map((image, index) => (
                <figure
                  key={image.id}
                  className={cx(
                    'sd-reveal rounded-2xl border-[3px] border-[#111] bg-white p-2.5 pb-3 transition-transform duration-300 hover:rotate-0',
                    STICKER_SHADOW,
                    ['-rotate-2', 'rotate-2', '-rotate-1'][index % 3],
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                  <img
                    src={image.imageUrl}
                    alt={image.caption ?? ''}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  {image.caption && (
                    <figcaption className="mt-2 truncate px-1 text-sm font-bold text-[#111]">{image.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Avis
          Bulles de bande dessinée. */}
      {reviews.length > 0 && (
        <section className="border-t-[3px] border-[#111] bg-[#111] py-16 text-white sm:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-black uppercase tracking-tight sm:text-6xl">{t.sectionTheyTalk}</h2>
              {data.averageRating !== null && (
                <p className="flex items-center gap-2 text-lg font-black">
                  <Star weight="fill" className="h-6 w-6" style={{ color: YELLOW }} />
                  {t.ratingOutOf(data.averageRating.toFixed(1).replace('.', ','), data.reviews.length)}
                </p>
              )}
            </div>
            <ul className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-8 pt-2 [scrollbar-width:none]">
              {reviews.map((review, index) => (
                <li key={review.id} className="w-[80vw] max-w-[23rem] shrink-0 snap-start">
                  <div
                    className={cx(
                      'relative rounded-[1.5rem] border-[3px] border-white bg-white p-6 text-[#111]',
                      index % 2 === 0 ? '-rotate-1' : 'rotate-1',
                    )}
                    style={{ boxShadow: `6px 6px 0 var(--brand)` }}
                  >
                    <p className="flex gap-0.5" aria-label={t.ratingSimple(String(review.rating))}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          weight="fill"
                          aria-hidden="true"
                          className="h-5 w-5"
                          style={{ color: i < review.rating ? 'var(--brand)' : '#d4d4d4' }}
                        />
                      ))}
                    </p>
                    <blockquote className="mt-3 line-clamp-4 text-lg font-bold leading-snug">“{review.comment}”</blockquote>
                    {/* Pointe de la bulle. */}
                    <span aria-hidden="true" className="absolute -bottom-3 left-8 h-5 w-5 rotate-45 border-b-[3px] border-r-[3px] border-white bg-white" />
                  </div>
                  <p className="mt-5 ps-4 text-sm font-black uppercase text-white/80">{review.customerName}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Nous trouver */}
      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div className={cx('sd-reveal rounded-[1.75rem] border-[3px] border-[#111] bg-surface p-6 sm:p-8', BLOCK_SHADOW)}>
            <h2 className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight sm:text-3xl">
              <Clock weight="bold" className="h-8 w-8" style={{ color: 'var(--brand)' }} />
              {t.sectionHours}
            </h2>
            {data.openingHours.length > 0 ? (
              <dl className="mt-6 space-y-1.5">
                {weekOrder(data.openingHours).map((hour) => {
                  const isToday = hour.dayOfWeek === data.today;
                  return (
                    <div
                      key={hour.dayOfWeek}
                      className={cx(
                        'flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm',
                        isToday ? 'border-[#111] font-black' : 'border-transparent font-semibold text-ink-muted',
                      )}
                      style={isToday ? { backgroundColor: YELLOW, color: INK } : undefined}
                    >
                      <dt className="capitalize">
                        {days[hour.dayOfWeek]}
                        {isToday && <span className="ms-2 text-xs uppercase">{t.today}</span>}
                      </dt>
                      <dd className="tabular-nums">{hour.isClosed ? t.closed : `${hour.opensAt} - ${hour.closesAt}`}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-6 text-ink-muted">{t.hoursUnknown}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {data.location.phone && (
                <a
                  href={`tel:${data.location.phone}`}
                  className={cx('inline-flex h-12 items-center gap-2 rounded-xl border-[3px] border-[#111] bg-white px-5 font-black uppercase text-[#111] transition-transform active:translate-y-0.5', STICKER_SHADOW)}
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
                  className={cx('inline-flex h-12 items-center gap-2 rounded-xl border-[3px] border-[#111] bg-[#25d366] px-5 font-black uppercase text-[#111] transition-transform active:translate-y-0.5', STICKER_SHADOW)}
                >
                  <WhatsappLogo weight="fill" className="h-5 w-5" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className={cx('sd-reveal relative min-h-[18rem] overflow-hidden rounded-[1.75rem] border-[3px] border-[#111]', BLOCK_SHADOW)} style={{ backgroundColor: 'var(--brand)' }}>
            {data.location.mapEmbedSrc ? (
              <iframe title={t.mapTitle} src={data.location.mapEmbedSrc} loading="lazy" className="absolute inset-0 h-full w-full" />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle, #000 1.3px, transparent 1.6px)', backgroundSize: '14px 14px' }}
                />
                <MapPin weight="fill" className="sd-float relative mb-16 h-20 w-20 text-white drop-shadow-[4px_4px_0_#111]" />
              </div>
            )}
            <div className={cx('absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl border-[3px] border-[#111] bg-white p-4 text-[#111]', STICKER_SHADOW)}>
              <MapPin weight="fill" className="mt-0.5 h-6 w-6 shrink-0" style={{ color: 'var(--brand)' }} />
              <div className="min-w-0 text-sm">
                <p className="font-black uppercase">
                  {[data.location.addressLine, data.location.city].filter(Boolean).join(', ') || hero.name}
                </p>
                {data.location.mapLinkUrl && (
                  <a href={data.location.mapLinkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-bold underline underline-offset-4">
                    {t.viewOnMap}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Appel final */}
      {hero.orderingEnabled && (
        <section className="container-page pb-20 sm:pb-28">
          <div
            className={cx('sd-reveal relative isolate overflow-hidden rounded-[2rem] border-[4px] border-[#111] px-6 py-14 text-center sm:px-12 sm:py-20', BLOCK_SHADOW)}
            style={{ backgroundColor: YELLOW, color: INK }}
          >
            <Burst fill="var(--brand)" spin className="absolute -right-16 -top-16 -z-10 h-36 w-36 sm:-right-24 sm:-top-24 sm:h-72 sm:w-72" />
            <Burst fill="#ffffff" spin className="absolute -bottom-16 -left-14 -z-10 h-36 w-36 sm:-bottom-28 sm:-left-20 sm:h-72 sm:w-72" />
            <p className="mx-auto max-w-2xl text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
              {hero.name}
            </p>
            <p className="mx-auto mt-4 max-w-md font-bold">{t.hotAndFast}</p>
            <Link
              href={hero.menuHref}
              className="group mt-9 inline-flex h-16 items-center gap-3 rounded-2xl border-[3px] border-[#111] bg-[#111] px-8 text-lg font-black uppercase text-white shadow-[6px_6px_0_var(--brand)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {t.ctaOrderNow}
              <ArrowRight weight="bold" className="h-6 w-6 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
