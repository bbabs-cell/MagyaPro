import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Star,
  WhatsappLogo,
} from '@phosphor-icons/react/dist/ssr';

import { formatMoney } from '@/lib/money';
import { dayNames } from '@/lib/site/hours';
import { getServerDictionary } from '@/lib/i18n/server';
import { cx } from '@/components/ui';
import { QuickAddButton } from '@/components/site/quick-add-button';
import { DishPlaceholder } from '@/components/site/templates/menu-board';
import { templateRenderer, type MenuProduct } from '@/components/site/templates';
import type { ElegantHomeData } from '@/components/site/templates/elegant-home';

/**
 * Template « Moderne » : une vitrine d'une seule page, pensée pour donner
 * faim et faire commander, sur un téléphone d'abord.
 *
 * Lecture : vitrine de restaurant pour des clients sur mobile en Afrique de
 * l'Ouest, langage « premium consumer » chaleureux, tiré par la couleur du
 * restaurant. Mouvement présent mais calme (voir « Vitrines : motion design »
 * dans `globals.css`) : le titre se révèle mot à mot, les plats flottent, les
 * sections montent à mesure qu'on défile, le récit s'encre pendant la lecture.
 *
 * Chaque section a une mise en page différente — héros en deux volets, bandeau
 * défilant, carrousel, mosaïque de la carte, citation pleine largeur, galerie,
 * avis, informations pratiques, appel final — pour qu'aucune ne répète la
 * précédente.
 *
 * Tout ce qui est affiché vient du restaurant : ses plats, ses prix, ses
 * ventes réelles, ses avis. Rien n'est inventé.
 */

export type PopularProduct = MenuProduct & {
  categoryName: string;
  /** Quantité commandée sur les 30 derniers jours ; 0 quand on retombe sur la sélection du restaurant. */
  orderedCount: number;
};

export type ModernHomeData = ElegantHomeData & {
  popular: PopularProduct[];
  reservationHref: string | null;
};

function DishImage({
  product,
  className,
  priority = false,
}: {
  product: Pick<MenuProduct, 'name' | 'imageUrl'> & { categoryName?: string };
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cx('relative overflow-hidden', className)}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire
        <img
          src={product.imageUrl}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <DishPlaceholder name={product.name} category={product.categoryName} />
      )}
    </div>
  );
}

/** Le nom du restaurant, mot par mot, pour l'entrée en cascade du titre. */
function KineticTitle({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <h1 className="text-[2.75rem] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="sd-word me-[0.22em]" style={{ '--i': index } as React.CSSProperties}>
            {word}
          </span>
        ))}
      </span>
    </h1>
  );
}

export async function ModernHomePage({ data }: { data: ModernHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const t = dict.templates;
  const { Menu } = templateRenderer('modern');
  const hero = data.hero;
  const days = dayNames(locale);
  const stage = data.popular.slice(0, 3);
  const whatsapp = data.location.whatsappNumber?.replace(/[^\d]/g, '') ?? null;
  const hasStory = Boolean(data.story);
  const hasReviews = data.reviewsEnabled && data.reviews.length > 0;

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ Héros */}
      <section className="relative isolate overflow-hidden">
        {/* Fond vivant : trois halos de la couleur du restaurant qui dérivent
            lentement. Décor pur : `aria-hidden`, hors des clics. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="sd-mesh absolute -left-[15%] -top-[20%] h-[70vmin] w-[70vmin] rounded-full opacity-[0.22] blur-3xl"
            style={{ backgroundColor: 'var(--brand)' }}
          />
          <div
            className="sd-mesh absolute -right-[10%] top-[10%] h-[55vmin] w-[55vmin] rounded-full opacity-[0.16] blur-3xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 55%, #f59e0b)', '--d': '-7s' } as React.CSSProperties}
          />
          <div
            className="sd-mesh absolute bottom-[-25%] left-[30%] h-[50vmin] w-[50vmin] rounded-full opacity-[0.12] blur-3xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 40%, #ec4899)', '--d': '-14s' } as React.CSSProperties}
          />
        </div>

        <div className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:min-h-[min(46rem,calc(100dvh-4rem))] lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-16">
          <div>
            <p
              className="sd-rise inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface/70 px-3.5 py-1.5 text-sm backdrop-blur"
              style={{ '--d': '0ms' } as React.CSSProperties}
            >
              {/* Pastille d'état réelle : ouvert (vert) ou fermé (rouge). */}
              <span className="relative flex h-2.5 w-2.5">
                {hero.isOpenNow && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                )}
                <span
                  className={cx(
                    'relative inline-flex h-2.5 w-2.5 rounded-full',
                    hero.isOpenNow ? 'bg-emerald-500' : 'bg-red-500',
                  )}
                />
              </span>
              {hero.openLabel}
            </p>

            <div className="mt-6">
              <KineticTitle text={hero.name} />
            </div>

            {hero.description && (
              <p
                className="sd-rise mt-6 line-clamp-3 max-w-[34rem] text-lg leading-relaxed text-ink-muted"
                style={{ '--d': '450ms' } as React.CSSProperties}
              >
                {hero.description}
              </p>
            )}

            <div
              className="sd-rise mt-9 flex flex-wrap items-center gap-3"
              style={{ '--d': '600ms' } as React.CSSProperties}
            >
              <Link
                href={hero.menuHref}
                className="group inline-flex h-14 items-center gap-2.5 rounded-full px-7 text-base font-semibold text-white shadow-[0_18px_40px_-16px_var(--brand)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {hero.orderingEnabled ? t.ctaOrderNow : t.ctaSeeMenu}
                <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              {data.reservationHref ? (
                <Link
                  href={data.reservationHref}
                  className="inline-flex h-14 items-center rounded-full border border-surface-border bg-surface/70 px-7 font-semibold backdrop-blur transition-colors hover:bg-surface-sunken"
                >
                  {dict.nav.reserve}
                </Link>
              ) : (
                <Link
                  href={hero.infosHref}
                  className="inline-flex h-14 items-center rounded-full border border-surface-border bg-surface/70 px-7 font-semibold backdrop-blur transition-colors hover:bg-surface-sunken"
                >
                  {t.sectionFind}
                </Link>
              )}
            </div>
          </div>

          {/* Scène : la photo de couverture et deux plats qui flottent devant,
              ou, sans photo, les trois plats les plus commandés en éventail. */}
          <div className="relative mx-auto w-full max-w-[34rem]">
            {hero.coverUrl ? (
              <div className="relative">
                <div className="sd-rise aspect-[4/5] overflow-hidden rounded-[2.25rem] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)]" style={{ '--d': '200ms' } as React.CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire */}
                  <img src={hero.coverUrl} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
                </div>
                {stage.slice(0, 2).map((product, index) => (
                  <FloatingDish
                    key={product.id}
                    product={product}
                    currency={data.currency}
                    className={index === 0 ? '-left-4 bottom-10 sm:-left-10' : '-right-3 top-8 sm:-right-8'}
                    tilt={index === 0 ? -3 : 4}
                    delay={index === 0 ? 0 : -3500}
                  />
                ))}
              </div>
            ) : stage.length > 0 ? (
              <div className="relative h-[24rem] sm:h-[30rem]">
                {stage.map((product, index) => (
                  <div
                    key={product.id}
                    className={cx(
                      'sd-rise absolute w-[60%]',
                      index === 0 && 'left-0 top-0 z-10',
                      index === 1 && 'right-0 top-14 z-20 sm:top-16',
                      index === 2 && 'bottom-0 left-[20%] z-30',
                    )}
                    style={{ '--d': `${250 + index * 140}ms` } as React.CSSProperties}
                  >
                    {/* Nom et prix en haut de la carte : les cartes se
                        chevauchent par le bas, l'étiquette reste lisible. */}
                    <Link
                      href={product.href}
                      className="sd-float group block overflow-hidden rounded-[1.75rem] border border-white/50 bg-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]"
                      style={{ '--sd-tilt': `${[-5, 4, -2][index]}deg`, '--d': `${index * -2300}ms` } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <p className="min-w-0 truncate text-sm font-semibold">{product.name}</p>
                        <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
                          {formatMoney(product.price, data.currency)}
                        </p>
                      </div>
                      <DishImage product={product} className="aspect-[4/3]" priority={index === 0} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- Bandeau des plats
          Le seul défilement continu de la page : les plats et leurs prix,
          comme le tableau qui défile au-dessus d'un comptoir. */}
      {data.popular.length > 0 && (
        <div className="overflow-hidden py-4 text-white" style={{ backgroundColor: 'var(--brand)' }}>
          <div className="marquee-track flex w-max gap-12 whitespace-nowrap" style={{ animationDuration: '38s' }}>
            {[...data.popular, ...data.popular, ...data.popular, ...data.popular].map((product, index) => (
              <span key={`${product.id}-${index}`} className="flex items-center gap-3 text-lg font-semibold" aria-hidden={index >= data.popular.length || undefined}>
                <Star weight="fill" className="h-4 w-4 text-white/70" />
                {product.name}
                <span className="font-normal text-white/80">{formatMoney(product.price, data.currency)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------- Les plus commandés */}
      {data.popular.length > 0 && (
        <section className="sd-reveal py-16 sm:py-24">
          <div className="container-page flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.sectionMostOrdered}</h2>
            <Link
              href={data.menuHref}
              className="group hidden shrink-0 items-center gap-2 font-semibold sm:inline-flex"
              style={{ color: 'var(--brand)' }}
            >
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Carrousel à aimantation : on fait glisser du pouce, une carte à
              la fois ; celle du centre est pleine, ses voisines en retrait. */}
          <ol className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[max(1rem,calc((100vw-72rem)/2))] pb-6 [scrollbar-width:none]">
            {data.popular.map((product, index) => (
              <li key={product.id} className="sd-snap-card group relative w-[78vw] max-w-[22rem] shrink-0 snap-center">
                <Link href={product.href} className="block overflow-hidden rounded-[2rem] border border-surface-border bg-surface shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)]">
                  <div className="relative">
                    <DishImage product={product} className="aspect-[4/5]" />
                    {/* Rang : le chiffre en grand, en contour, posé sur l'image —
                        blanc sur une photo, couleur du restaurant sur le visuel
                        sans photo, plus clair. */}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'absolute left-4 top-1 text-[5.5rem] font-black leading-none text-transparent',
                        product.imageUrl
                          ? '[-webkit-text-stroke:2px_rgba(255,255,255,0.9)] [text-shadow:0_4px_24px_rgba(0,0,0,0.25)]'
                          : '[-webkit-text-stroke:2px_var(--brand)]',
                      )}
                    >
                      {index + 1}
                    </span>
                    {product.imageUrl && (
                      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                    )}
                    <div className={cx('absolute inset-x-0 bottom-0 p-5', product.imageUrl ? 'text-white' : 'text-ink')}>
                      <p className="text-xl font-bold leading-tight">{product.name}</p>
                      {product.orderedCount > 0 && (
                        <p className={cx('mt-1 text-sm', product.imageUrl ? 'text-white/80' : 'text-ink-muted')}>
                          {t.orderedTimes(product.orderedCount)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="mt-4 flex items-center justify-between gap-3 px-1">
                  <p className="text-lg font-bold tabular-nums">{formatMoney(product.price, data.currency)}</p>
                  {data.hero.orderingEnabled && (
                    <QuickAddButton
                      product={product}
                      className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--brand)' }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ----------------------------------------------------------- Carte */}
      <section id="carte" className="sd-reveal border-t border-surface-border bg-surface-sunken/60 py-16 sm:py-24">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.sectionOurMenu}</h2>
          </div>
          <div className="mt-10">
            <Menu categories={data.menuCategories} currency={data.currency} />
          </div>
          <div className="mt-12 flex justify-center">
            <Link
              href={data.menuHref}
              className="group inline-flex h-14 items-center gap-2.5 rounded-full border border-ink px-8 font-semibold transition-colors hover:bg-ink hover:text-surface"
            >
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Histoire
          Citation pleine largeur qui « s'encre » pendant la lecture. */}
      {(hasStory || data.chef) && (
        <section className="py-20 sm:py-28">
          <div
            className={cx(
              'container-page grid gap-12 lg:items-center',
              hasStory && data.chef ? 'lg:grid-cols-[1.4fr_1fr]' : 'max-w-5xl',
            )}
          >
            {hasStory && (
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  {t.sectionStory}
                </h2>
                <p className="sd-ink mt-5 text-3xl font-semibold leading-[1.25] tracking-tight sm:text-4xl lg:text-5xl">
                  {data.story}
                </p>
              </div>
            )}
            {data.chef && (
              <figure className="sd-reveal flex items-center gap-5 rounded-[2rem] border border-surface-border bg-surface p-5 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.35)]">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                  {data.chef.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                    <img src={data.chef.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <DishPlaceholder name="chef" category="cuisine" />
                  )}
                </div>
                <figcaption className="min-w-0">
                  <p className="text-sm text-ink-muted">{t.sectionChef}</p>
                  <p className="text-xl font-bold">{data.chef.name}</p>
                  {data.chef.bio && <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{data.chef.bio}</p>}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Galerie */}
      {data.gallery.length > 0 && (
        <section className="sd-reveal pb-20 sm:pb-28">
          <div className="container-page">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.sectionAmbience}</h2>
            <div className="mt-10 columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
              {data.gallery.slice(0, 9).map((image, index) => (
                <figure key={image.id} className="group overflow-hidden rounded-[1.5rem] break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                  <img
                    src={image.imageUrl}
                    alt={image.caption ?? ''}
                    loading="lazy"
                    decoding="async"
                    className={cx(
                      'w-full object-cover transition-transform duration-700 group-hover:scale-105',
                      ['aspect-[4/5]', 'aspect-square', 'aspect-[3/4]'][index % 3],
                    )}
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Avis */}
      {hasReviews && (
        <section className="sd-reveal border-y border-surface-border py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.sectionCustomerReviews}</h2>
              {data.averageRating !== null && (
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Star weight="fill" className="h-6 w-6 text-amber-400" />
                  {t.ratingOutOf(data.averageRating.toFixed(1).replace('.', ','), data.reviews.length)}
                </p>
              )}
            </div>
            <ul className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none]">
              {data.reviews
                .filter((review) => review.comment)
                .slice(0, 8)
                .map((review) => (
                  <li
                    key={review.id}
                    className="w-[80vw] max-w-[24rem] shrink-0 snap-start rounded-[1.75rem] border border-surface-border bg-surface p-6"
                  >
                    <p className="flex gap-0.5" aria-label={t.ratingSimple(String(review.rating))}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          weight="fill"
                          aria-hidden="true"
                          className={cx('h-4 w-4', i < review.rating ? 'text-amber-400' : 'text-surface-border')}
                        />
                      ))}
                    </p>
                    <blockquote className="mt-4 line-clamp-4 text-lg leading-snug">“{review.comment}”</blockquote>
                    <p className="mt-4 text-sm font-semibold text-ink-muted">{review.customerName}</p>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Nous trouver */}
      <section className="sd-reveal py-16 sm:py-24">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-surface-border bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
              <Clock weight="duotone" className="h-7 w-7" style={{ color: 'var(--brand)' }} />
              {t.sectionHours}
            </h2>
            {data.openingHours.length > 0 ? (
              <dl className="mt-6 space-y-1">
                {[...data.openingHours]
                  .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
                  .map((hour) => {
                    const isToday = hour.dayOfWeek === data.today;
                    return (
                      <div
                        key={hour.dayOfWeek}
                        className={cx(
                          'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                          isToday ? 'font-semibold' : 'text-ink-muted',
                        )}
                        style={isToday ? { backgroundColor: 'color-mix(in srgb, var(--brand) 12%, transparent)' } : undefined}
                      >
                        <dt className="capitalize">
                          {days[hour.dayOfWeek]}
                          {isToday && <span className="ms-2 text-xs" style={{ color: 'var(--brand)' }}>{t.today}</span>}
                        </dt>
                        <dd className="tabular-nums">
                          {hour.isClosed ? t.closed : `${hour.opensAt} - ${hour.closesAt}`}
                        </dd>
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
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-surface-border px-5 font-semibold transition-colors hover:bg-surface-sunken"
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

          <div className="relative min-h-[18rem] overflow-hidden rounded-[2rem] border border-surface-border bg-surface-sunken">
            {data.location.mapEmbedSrc ? (
              <iframe
                title={t.mapTitle}
                src={data.location.mapEmbedSrc}
                loading="lazy"
                className="absolute inset-0 h-full w-full grayscale-[30%]"
              />
            ) : (
              // Sans coordonnées, pas de carte à afficher : un repère animé
              // (ondes autour d'une épingle) plutôt qu'un rectangle vide.
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-[0.18]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, var(--brand) 1px, transparent 1.4px)',
                    backgroundSize: '18px 18px',
                  }}
                />
                {[0, 1, 2].map((ring) => (
                  <span
                    key={ring}
                    className="absolute h-40 w-40 rounded-full border-2 motion-safe:animate-[sd-ring_3.6s_ease-out_infinite]"
                    style={{ borderColor: 'var(--brand)', animationDelay: `${ring * 1.2}s`, opacity: 0.35 }}
                  />
                ))}
                <MapPin weight="fill" className="sd-float relative mb-16 h-16 w-16 drop-shadow-xl" style={{ color: 'var(--brand)' }} />
              </div>
            )}
            <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl bg-surface/90 p-4 shadow-lg backdrop-blur">
              <MapPin weight="fill" className="mt-0.5 h-6 w-6 shrink-0" style={{ color: 'var(--brand)' }} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {[data.location.addressLine, data.location.city].filter(Boolean).join(', ') || hero.name}
                </p>
                {data.location.mapLinkUrl && (
                  <a
                    href={data.location.mapLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block underline underline-offset-4"
                  >
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
            className="sd-reveal relative isolate overflow-hidden rounded-[2.5rem] px-6 py-14 text-center text-white sm:px-12 sm:py-20"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            <div
              aria-hidden="true"
              className="sd-mesh absolute -right-20 -top-24 -z-10 h-80 w-80 rounded-full bg-white/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="sd-mesh absolute -bottom-28 -left-16 -z-10 h-80 w-80 rounded-full bg-black/20 blur-3xl"
              style={{ '--d': '-9s' } as React.CSSProperties}
            />
            <p className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{hero.name}</p>
            <p className="mx-auto mt-4 max-w-md text-white/85">{hero.openLabel}</p>
            <Link
              href={hero.menuHref}
              className="group mt-8 inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-8 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
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

/** Carte de plat qui flotte devant la photo de couverture. */
function FloatingDish({
  product,
  currency,
  className,
  tilt,
  delay,
}: {
  product: PopularProduct;
  currency: string;
  className: string;
  tilt: number;
  delay: number;
}) {
  return (
    <Link
      href={product.href}
      className={cx(
        'sd-float absolute flex w-56 items-center gap-3 rounded-2xl border border-white/50 bg-surface/90 p-2.5 pe-4 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur-md',
        className,
      )}
      style={{ '--sd-tilt': `${tilt}deg`, '--d': `${delay}ms` } as React.CSSProperties}
    >
      <DishImage product={product} className="h-14 w-14 shrink-0 rounded-xl" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{product.name}</span>
        <span className="block text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
          {formatMoney(product.price, currency)}
        </span>
      </span>
    </Link>
  );
}
