import Link from 'next/link';
import { ArrowRight, Checks, MapPin, Moped, Phone, Star, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { dayNames } from '@/lib/site/hours';
import { QuickAddButton } from '@/components/site/quick-add-button';
import { OfferCountdown } from '@/components/site/templates/offer-countdown';
import { StreetFoodMenuFilter } from '@/components/site/templates/street-food-menu-filter';
import { GalleryLightbox } from '@/components/site/templates/gallery-lightbox';
import { MenuBoard } from '@/components/site/templates/menu-board';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  whatsappDigits,
  type PopularHomeData,
} from '@/components/site/templates/home-parts';
import { getServerDictionary } from '@/lib/i18n/server';
import { formatDecimal } from '@/lib/numbers';

/**
 * Template « Street Food » : une page unique de marché de nuit.
 *
 * Lecture : la rue après le coucher du soleil — fond presque noir, enseignes
 * au néon à la couleur du restaurant, tickets de commande, et les avis qui
 * arrivent comme des messages WhatsApp. Signes propres à ce template :
 * - le **néon** : le nom s'allume en grésillant à l'arrivée, les cadres et
 *   les titres brillent de la couleur du restaurant ;
 * - les **tickets de commande** : les plus commandés, sur des tickets de
 *   caisse dentelés, numérotés, qu'on fait défiler du pouce ;
 * - la **conversation** : les avis en bulles de messagerie, cochés lus ;
 * - la carte **filtrable** et l'**offre en compte à rebours** quand une
 *   promotion est active.
 *
 * Tout ce qui est affiché vient du restaurant. Rien n'est inventé.
 */

export type StreetFoodHomeData = PopularHomeData & {
  offer: { code: string; label: string; endsAt: string } | null;
};

const NIGHT = '#0e0d12';
const NIGHT_SOFT = '#17151d';

/** Halo de néon autour d'un texte, à la couleur du restaurant. */
const NEON_TEXT: React.CSSProperties = {
  textShadow:
    '0 0 6px color-mix(in srgb, var(--brand) 90%, white), 0 0 18px var(--brand), 0 0 42px var(--brand)',
};

/** Tube de néon autour d'un cadre. */
const NEON_FRAME: React.CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand) 70%, white)',
  boxShadow: '0 0 12px var(--brand), 0 0 40px color-mix(in srgb, var(--brand) 55%, transparent), inset 0 0 18px color-mix(in srgb, var(--brand) 40%, transparent)',
};

/** Bord dentelé d'un ticket de caisse, découpé dans le bas de la carte. */
const TICKET_EDGE: React.CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, radial-gradient(circle at 8px 0, transparent 7px, #000 7.5px) bottom / 16px 10px repeat-x',
  maskImage:
    'linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, radial-gradient(circle at 8px 0, transparent 7px, #000 7.5px) bottom / 16px 10px repeat-x',
};

export async function StreetFoodHomePage({ data }: { data: StreetFoodHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const t = dict.templates;
  const hero = data.hero;
  const days = dayNames(locale);
  const whatsapp = whatsappDigits(data.location.whatsappNumber);
  const categoryNames = data.menuCategories.map((category) => category.name);
  const reviews = data.reviewsEnabled ? data.reviews.filter((review) => review.comment).slice(0, 6) : [];

  return (
    <div className="overflow-x-clip text-white" style={{ backgroundColor: NIGHT }}>
      {/* ------------------------------------------------------------ Héros */}
      <section className="relative isolate overflow-hidden">
        {/* Lueurs de la rue derrière le texte : deux halos colorés qui dérivent. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="sd-mesh absolute -left-[10%] top-[-20%] h-[60vmin] w-[60vmin] rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: 'var(--brand)' }}
          />
          <div
            className="sd-mesh absolute bottom-[-30%] right-[-5%] h-[55vmin] w-[55vmin] rounded-full bg-fuchsia-600 opacity-20 blur-3xl"
            style={{ '--d': '-8s' } as React.CSSProperties}
          />
        </div>

        <div className="container-page grid items-center gap-14 pb-20 pt-14 sm:pt-20 lg:min-h-[min(44rem,calc(100dvh-4rem))] lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="sd-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
              <span
                aria-hidden="true"
                className={cx('h-2 w-2 rounded-full', hero.isOpenNow ? 'bg-emerald-400' : 'bg-red-400')}
              />
              {hero.openLabel}
            </span>

            {/* L'enseigne s'allume en grésillant ; le halo (text-shadow) est
                hérité par le titre, qui reste blanc et net au centre. */}
            <div className="sd-flicker" style={NEON_TEXT}>
              <KineticTitle
                text={hero.name}
                className="mt-6 text-[3.4rem] font-black uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl"
              />
            </div>

            {hero.description && (
              <p className="sd-rise mt-6 max-w-lg text-lg text-white/75" style={{ '--d': '450ms' } as React.CSSProperties}>
                {hero.description}
              </p>
            )}

            <div className="sd-rise mt-9 flex flex-wrap gap-3" style={{ '--d': '600ms' } as React.CSSProperties}>
              <Link
                href={hero.menuHref}
                className="group inline-flex h-14 items-center gap-2.5 rounded-full px-8 text-sm font-black uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--brand)', boxShadow: '0 0 24px var(--brand)' }}
              >
                {hero.orderingEnabled ? t.ctaOrderNow : t.ctaSeeMenu}
                <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href={hero.infosHref}
                className="inline-flex h-14 items-center rounded-full border-2 border-white/40 px-8 text-sm font-bold uppercase tracking-wide transition-colors hover:border-white"
              >
                {t.sectionFind}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[30rem]">
            <div
              className="sd-rise aspect-square overflow-hidden rounded-[2.5rem] border-2"
              style={{ ...NEON_FRAME, '--d': '250ms' } as React.CSSProperties}
            >
              {hero.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                <img src={hero.coverUrl} alt="" fetchPriority="high" decoding="async" className="sd-kenburns h-full w-full object-cover" />
              ) : data.popular[0] ? (
                <DishImage product={data.popular[0]} className="h-full w-full" priority />
              ) : (
                <MenuBoard name={hero.name} items={hero.board} title={t.boardTitle} primaryColor="#ffffff" />
              )}
            </div>

            {data.averageRating !== null && (
              <div
                className="sd-float absolute -left-3 top-8 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-black shadow-xl sm:-left-6"
                style={{ '--sd-tilt': '-3deg' } as React.CSSProperties}
              >
                <Star weight="fill" className="h-5 w-5 text-amber-400" />
                <div className="leading-tight">
                  <span className="block text-sm font-black">{formatDecimal(data.averageRating, 1, locale)}/5</span>
                  <span className="block text-[0.65rem] text-black/60">{t.reviewCount(data.reviews.length)}</span>
                </div>
              </div>
            )}
            {data.popular[0] && (
              <Link
                href={data.popular[0].href}
                className="sd-float absolute -bottom-5 right-3 flex max-w-[75%] items-center gap-3 rounded-2xl bg-white p-2 pe-4 text-black shadow-xl sm:-right-4"
                style={{ '--sd-tilt': '3deg', '--d': '-3200ms' } as React.CSSProperties}
              >
                <DishImage product={data.popular[0]} className="h-12 w-12 shrink-0 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black uppercase">{data.popular[0].name}</span>
                  <span className="block text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
                    {formatMoney(data.popular[0].price, data.currency)}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {categoryNames.length > 0 && (
        <div className="overflow-hidden border-y border-white/10 py-4" style={{ backgroundColor: NIGHT_SOFT }} aria-hidden="true">
          <div className="marquee-track flex w-max gap-12 whitespace-nowrap" style={{ animationDuration: '32s' }}>
            {[...categoryNames, ...categoryNames, ...categoryNames, ...categoryNames].map((name, index) => (
              <span key={`${name}-${index}`} className="text-xl font-black uppercase tracking-wide" style={NEON_TEXT}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------- Tickets de commande */}
      {data.popular.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-page flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-6xl" style={NEON_TEXT}>
              {t.sectionMostOrdered}
            </h2>
            <Link href={data.menuHref} className="group inline-flex items-center gap-2 font-bold uppercase text-white/80 hover:text-white">
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <ol className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[max(1rem,calc((100vw-72rem)/2))] pb-6 pt-3 [scrollbar-width:none]">
            {data.popular.map((product, index) => (
              <li
                key={product.id}
                className="sd-snap-card w-[72vw] max-w-[17rem] shrink-0 snap-center"
              >
                <div
                  className="bg-[#fbf8f1] pb-6 text-[#151515] transition-transform duration-300 hover:rotate-0"
                  style={{ ...TICKET_EDGE, transform: `rotate(${index % 2 === 0 ? -1.5 : 1.5}deg)` }}
                >
                  <div className="flex items-center justify-between border-b border-dashed border-black/25 px-5 py-3 font-mono text-xs uppercase">
                    <span>N° {String(index + 1).padStart(2, '0')}</span>
                    <span>{product.categoryName}</span>
                  </div>
                  <Link href={product.href} className="group block px-5 pt-4">
                    <DishImage product={product} className="aspect-[4/3] w-full rounded-lg" />
                    <span className="mt-4 block text-lg font-black uppercase leading-tight">{product.name}</span>
                    {product.orderedCount > 0 && (
                      <span className="mt-1 block font-mono text-xs text-black/55">{t.orderedTimes(product.orderedCount)}</span>
                    )}
                  </Link>
                  <div className="mx-5 mt-3 flex items-baseline gap-2 font-mono text-sm">
                    <span className="text-black/60">1 ×</span>
                    <span aria-hidden="true" className="flex-1 border-b border-dotted border-black/30" />
                    <span className="shrink-0 font-bold">{formatMoney(product.price, data.currency)}</span>
                  </div>
                  {hero.orderingEnabled && (
                    <div className="px-5 pt-4">
                      <QuickAddButton
                        product={product}
                        className="flex h-11 w-full items-center justify-center rounded-full text-sm font-black uppercase text-white transition-transform active:scale-95 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand)' }}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------------------------------------------------- Histoire, chef */}
      {(data.story || data.chef) && (
        <section className="border-t border-white/10 py-16 sm:py-24">
          <div className={cx('container-page grid gap-12 lg:items-center', data.story && data.chef ? 'lg:grid-cols-[1.3fr_0.7fr]' : 'max-w-4xl')}>
            {data.story && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'color-mix(in srgb, var(--brand) 70%, white)' }}>
                  {t.sectionStory}
                </h2>
                <p className="sd-ink mt-5 text-3xl font-black leading-[1.15] sm:text-4xl" style={{ '--ink': '#ffffff' } as React.CSSProperties}>
                  {data.story}
                </p>
              </div>
            )}
            {data.chef && (
              <figure className="sd-reveal flex flex-col items-center gap-5 text-center">
                <span className="relative h-36 w-36 overflow-hidden rounded-full border-2" style={NEON_FRAME}>
                  {data.chef.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo de tenant
                    <img src={data.chef.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-5xl font-black">
                      {data.chef.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <figcaption>
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">{t.sectionKitchen}</span>
                  <span className="mt-1 block text-3xl font-black">{data.chef.name}</span>
                  {data.chef.bio && <span className="mt-2 block text-white/70">{data.chef.bio}</span>}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Carte
          Sous la lumière du comptoir : fond clair, carte filtrable. */}
      <section id="menu" className="bg-surface py-16 text-ink sm:py-24">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--brand)' }}>
              {t.sectionWhatsCooking}
            </span>
            <h2 className="mt-3 text-4xl font-black uppercase tracking-tight sm:text-5xl">{t.sectionOurMenu}</h2>
          </div>
          {data.menuCategories.length === 0 ? (
            <p className="text-center text-ink-muted">{t.menuPreparing}</p>
          ) : (
            <StreetFoodMenuFilter categories={data.menuCategories} currency={data.currency} />
          )}
          <div className="mt-12 text-center">
            <Link
              href={data.menuHref}
              className="inline-flex h-12 items-center rounded-full border-2 border-ink px-8 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-surface"
            >
              {dict.menuPage.seeAll}
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Offre */}
      {data.offer && (
        <section className="py-16 sm:py-20">
          <div className="container-page">
            <div
              className="sd-reveal grid gap-8 rounded-[2rem] border-2 p-8 sm:p-12 lg:grid-cols-2 lg:items-center"
              style={{ ...NEON_FRAME, backgroundColor: NIGHT_SOFT }}
            >
              <div>
                <span className="inline-flex rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
                  {t.offerLimited}
                </span>
                <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl" style={NEON_TEXT}>
                  {data.offer.label}
                </h2>
                <p className="mt-4 text-white/70">{t.offerCodeNote(data.offer.code)}</p>
              </div>
              <div className="flex justify-start lg:justify-end">
                <OfferCountdown endsAt={data.offer.endsAt} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Galerie */}
      {data.gallery.length > 0 && (
        <section className="border-t border-white/10 py-16 sm:py-24">
          <div className="container-page">
            <h2 className="mb-10 text-center text-4xl font-black uppercase tracking-tight sm:text-5xl" style={NEON_TEXT}>
              {t.sectionInKitchen}
            </h2>
            <GalleryLightbox images={data.gallery} />
          </div>
        </section>
      )}

      {/* --------------------------------------------------- Conversation
          Les avis comme des messages reçus : bulles, nom, double coche. */}
      {reviews.length > 0 && (
        <section className="border-t border-white/10 py-16 sm:py-24">
          <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl" style={NEON_TEXT}>
                {t.sectionTheyTalk}
              </h2>
              {data.averageRating !== null && (
                <p className="mt-4 flex items-center gap-2 text-lg font-bold">
                  <Star weight="fill" className="h-5 w-5 text-amber-400" />
                  {t.ratingOutOf(formatDecimal(data.averageRating, 1, locale), data.reviews.length)}
                </p>
              )}
            </div>
            <ul
              className="space-y-4 rounded-[2rem] p-5 sm:p-7"
              style={{
                backgroundColor: '#0b141a',
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1.2px)',
                backgroundSize: '16px 16px',
              }}
            >
              {reviews.map((review, index) => (
                <li key={review.id} className={cx('sd-reveal flex', index % 2 === 1 && 'justify-end')}>
                  <div
                    className={cx(
                      'relative max-w-[85%] rounded-2xl px-4 py-3 text-[0.95rem] shadow-md',
                      index % 2 === 1 ? 'rounded-tr-sm bg-[#005c4b]' : 'rounded-tl-sm bg-[#202c33]',
                    )}
                  >
                    <p className="text-xs font-bold" style={{ color: index % 2 === 1 ? '#7fe3c2' : 'color-mix(in srgb, var(--brand) 60%, white)' }}>
                      {review.customerName}
                    </p>
                    <p className="mt-1 leading-snug">{review.comment}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-white/50">
                      <span aria-label={t.ratingSimple(String(review.rating))}>{'★'.repeat(review.rating)}</span>
                      <Checks weight="bold" aria-hidden="true" className="h-4 w-4 text-sky-400" />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Nous trouver */}
      <section className="border-t border-white/10 py-16 sm:py-24" style={{ backgroundColor: NIGHT_SOFT }}>
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">{t.sectionHours}</h2>
            <p className="mt-6 flex items-center gap-2 text-sm text-white/80">
              <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', hero.isOpenNow ? 'bg-emerald-400' : 'bg-red-400')} />
              {hero.openLabel}
            </p>
            {(data.location.addressLine || data.location.city) && (
              <p className="mt-5 text-2xl font-bold">
                {[data.location.addressLine, data.location.city, data.location.country].filter(Boolean).join(', ')}
              </p>
            )}
            <dl className="mt-7 space-y-2.5 text-sm">
              {weekOrder(data.openingHours).map((hour) => {
                const isToday = hour.dayOfWeek === data.today;
                return (
                  <div key={hour.dayOfWeek} className={cx('flex justify-between border-b border-white/10 pb-2', isToday ? 'font-bold text-white' : 'text-white/50')}>
                    <dt className="capitalize">
                      {days[hour.dayOfWeek]}
                      {isToday && <span className="ms-2 text-xs" style={{ color: 'color-mix(in srgb, var(--brand) 60%, white)' }}>{t.today}</span>}
                    </dt>
                    <dd className="tabular-nums">{hour.isClosed ? t.closed : `${hour.opensAt} – ${hour.closesAt}`}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              {data.location.phone && (
                <a href={`tel:${data.location.phone}`} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-white/30 px-4 font-bold hover:border-white">
                  <Phone weight="bold" className="h-4 w-4" />
                  {t.ctaCall}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-4 font-bold text-black"
                >
                  <WhatsappLogo weight="fill" className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div
            className="sd-reveal flex flex-col items-center justify-center gap-3 rounded-[2rem] p-8 text-center lg:w-72"
            style={{ backgroundColor: 'var(--brand)', boxShadow: '0 0 40px color-mix(in srgb, var(--brand) 60%, transparent)' }}
          >
            <Moped weight="fill" className="sd-float h-12 w-12" />
            <h3 className="text-xl font-black uppercase">{t.sectionOrderOnline}</h3>
            <p className="text-sm text-white/85">{t.hotAndFast}</p>
            <Link
              href={data.menuHref}
              className="mt-2 inline-flex h-11 items-center rounded-full bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
            >
              {hero.orderingEnabled ? t.ctaOrder : t.ctaSeeMenu}
            </Link>
          </div>

          <div className="relative min-h-[18rem] overflow-hidden rounded-[2rem] border border-white/15">
            {data.location.mapEmbedSrc ? (
              <iframe
                title={t.mapTitle}
                src={data.location.mapEmbedSrc}
                className="absolute inset-0 h-full w-full border-0 grayscale invert-[0.9]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                {[0, 1, 2].map((ring) => (
                  <span
                    key={ring}
                    className="absolute h-40 w-40 rounded-full border-2 motion-safe:animate-[sd-ring_3.6s_ease-out_infinite]"
                    style={{ borderColor: 'var(--brand)', animationDelay: `${ring * 1.2}s`, opacity: 0.4 }}
                  />
                ))}
                <MapPin weight="fill" className="relative mb-14 h-14 w-14" style={{ color: 'var(--brand)', filter: 'drop-shadow(0 0 12px var(--brand))' }} />
              </div>
            )}
            {data.location.mapLinkUrl && (
              <a
                href={data.location.mapLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 p-4 text-sm font-bold backdrop-blur hover:bg-black/80"
              >
                {t.viewOnMap}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
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
