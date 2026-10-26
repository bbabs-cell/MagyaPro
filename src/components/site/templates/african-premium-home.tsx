import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Phone, Star, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';

import { formatMoney } from '@/lib/money';
import { dayNames } from '@/lib/site/hours';
import { getServerDictionary } from '@/lib/i18n/server';
import { cx } from '@/components/ui';
import { QuickAddButton } from '@/components/site/quick-add-button';
import { DishPlaceholder } from '@/components/site/templates/menu-board';
import { templateRenderer } from '@/components/site/templates';
import {
  DishImage,
  KineticTitle,
  weekOrder,
  whatsappDigits,
  type PopularHomeData,
} from '@/components/site/templates/home-parts';

/**
 * Template « Africain premium » : une page unique, éditoriale, de nuit.
 *
 * Lecture : la table d'un grand restaurant ouest-africain un soir — fond
 * presque noir, or des laitons, couleur du restaurant pour l'action. Deux
 * signes visuels propres, qu'aucun autre template ne partage :
 * - le **motif wax** (cercles et losanges), dessiné à la couleur du
 *   restaurant, qui glisse lentement comme un tissu tendu ;
 * - l'**arche** : les photos des plats, du chef et de la galerie sont
 *   cadrées en arc, comme les portes des architectures sahéliennes.
 *
 * Le mouvement reste lent et grave : la couverture recule doucement à
 * l'ouverture, le nom se révèle mot à mot, les plats signature glissent de
 * part et d'autre en entrant à l'écran, le récit s'encre pendant la lecture.
 *
 * Tout ce qui est affiché vient du restaurant. Rien n'est inventé.
 */

const NIGHT = '#14100c';
const PAPER = '#f3eadb';
const GOLD = '#d6a756';

/**
 * Motif wax en tuile SVG, encodé pour un `background-image`.
 *
 * Un « œil » (cercle, anneau, point) au centre de chaque tuile, des quarts de
 * cercle aux coins qui forment un second motif à la jonction, des losanges
 * sur les bords : la grammaire des wax les plus courants, en deux couleurs.
 */
function waxPattern(color: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<circle cx="48" cy="48" r="30" fill="none" stroke="${accent}" stroke-width="3"/>
<circle cx="48" cy="48" r="18" fill="${color}"/>
<circle cx="48" cy="48" r="6" fill="${accent}"/>
<g fill="${accent}"><circle cx="0" cy="0" r="16"/><circle cx="96" cy="0" r="16"/><circle cx="0" cy="96" r="16"/><circle cx="96" cy="96" r="16"/></g>
<g fill="${color}"><path d="M48 0l7 7-7 7-7-7z"/><path d="M48 82l7 7-7 7-7-7z"/><path d="M0 41l7 7-7 7z"/><path d="M96 41l-7 7 7 7z"/></g>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Frise en dents de scie, façon bogolan, pour séparer les sections. */
function zigzag(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="14" viewBox="0 0 32 14"><path d="M0 12 8 2l8 10 8-10 8 10" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Bande de tissu wax qui défile lentement. Décor pur. */
function WaxBand({ color, className }: { color: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('sd-pattern h-10 w-full sm:h-12', className)}
      style={{
        backgroundImage: waxPattern(color, GOLD),
        backgroundSize: '48px 48px',
        backgroundColor: NIGHT,
        '--sd-pattern-size': '48px',
        '--sd-pattern-speed': '6s',
      } as React.CSSProperties}
    />
  );
}

function Zigzag({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('h-3.5 w-full', className)}
      style={{ backgroundImage: zigzag(GOLD), backgroundSize: '32px 14px', backgroundRepeat: 'repeat-x' }}
    />
  );
}

/** Petit ornement : deux filets dorés autour d'un losange. */
function Ornament({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx('flex items-center gap-3', className)}>
      <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
      <span className="h-2 w-2 rotate-45" style={{ backgroundColor: GOLD }} />
      <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
    </span>
  );
}

/** Photo cadrée en arche, doublée d'un filet doré décalé. */
function Arch({
  children,
  className,
  frame = true,
}: {
  children: React.ReactNode;
  className?: string;
  frame?: boolean;
}) {
  return (
    <div className={cx('relative', className)}>
      {frame && (
        <span
          aria-hidden="true"
          className="absolute -inset-2.5 translate-x-2 translate-y-2 rounded-t-full border sm:-inset-3"
          style={{ borderColor: GOLD, opacity: 0.55 }}
        />
      )}
      <div className="relative h-full w-full overflow-hidden rounded-t-full">{children}</div>
    </div>
  );
}

export async function AfricanPremiumHomePage({ data }: { data: PopularHomeData }) {
  const { locale, dict } = await getServerDictionary();
  const t = dict.templates;
  const { Menu } = templateRenderer('african-premium');
  const hero = data.hero;
  const days = dayNames(locale);
  const signatures = data.popular.slice(0, 4);
  const featured = data.popular[0] ?? null;
  const whatsapp = whatsappDigits(data.location.whatsappNumber);
  const hasStory = Boolean(data.story);
  const reviews = data.reviewsEnabled ? data.reviews.filter((review) => review.comment).slice(0, 8) : [];

  return (
    <div className="overflow-x-clip" style={{ backgroundColor: NIGHT, color: PAPER }}>
      {/* ------------------------------------------------------------ Héros */}
      <section className="relative isolate overflow-hidden">
        {hero.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire */}
            <img
              src={hero.coverUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="sd-kenburns absolute inset-0 -z-20 h-full w-full object-cover"
            />
            {/* Voile de nuit : opaque côté texte, la photo respire à droite. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{
                background: `linear-gradient(90deg, ${NIGHT} 0%, ${NIGHT}e6 38%, ${NIGHT}66 72%, ${NIGHT}33 100%), linear-gradient(0deg, ${NIGHT} 0%, transparent 35%)`,
              }}
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="sd-pattern absolute inset-0 -z-10 opacity-[0.07]"
            style={{
              backgroundImage: waxPattern(hero.primaryColor, GOLD),
              backgroundSize: '96px 96px',
              '--sd-pattern-speed': '40s',
            } as React.CSSProperties}
          />
        )}

        <div className="container-page grid items-end gap-12 pb-16 pt-20 sm:pb-20 sm:pt-28 lg:min-h-[min(46rem,calc(100dvh-4rem))] lg:grid-cols-[1.2fr_0.8fr] lg:pb-24">
          <div>
            <p
              className="sd-rise flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em]"
              style={{ color: GOLD }}
            >
              <span aria-hidden="true" className="h-px w-10" style={{ backgroundColor: GOLD }} />
              {hero.city ?? t.welcome}
            </p>

            <KineticTitle
              text={hero.name}
              className="mt-6 font-display text-[3.25rem] font-semibold leading-[0.98] tracking-tight sm:text-7xl lg:text-8xl"
            />

            {hero.description && (
              <p
                className="sd-rise mt-6 max-w-xl text-lg leading-relaxed"
                style={{ color: `${PAPER}b3`, '--d': '450ms' } as React.CSSProperties}
              >
                {hero.description}
              </p>
            )}

            <p
              className="sd-rise mt-7 flex items-center gap-2 text-sm"
              style={{ color: `${PAPER}99`, '--d': '550ms' } as React.CSSProperties}
            >
              <span
                aria-hidden="true"
                className={cx('h-2 w-2 rounded-full', hero.isOpenNow ? 'bg-emerald-400' : 'bg-red-400')}
              />
              {hero.openLabel}
            </p>

            <div
              className="sd-rise mt-9 flex flex-wrap gap-3"
              style={{ '--d': '650ms' } as React.CSSProperties}
            >
              <Link
                href={hero.menuHref}
                className="group inline-flex h-14 items-center gap-2.5 rounded-full px-8 font-semibold text-white shadow-[0_18px_40px_-18px_var(--brand)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {hero.orderingEnabled ? t.ctaOrderNow : t.ctaDiscoverMenu}
                <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href={data.reservationHref ?? hero.infosHref}
                className="inline-flex h-14 items-center rounded-full border px-8 font-medium transition-colors hover:bg-white/5"
                style={{ borderColor: `${GOLD}80`, color: PAPER }}
              >
                {data.reservationHref ? dict.nav.reserve : t.sectionFind}
              </Link>
            </div>
          </div>

          {/* Le plat le plus commandé, en arche, posé sur la couverture. */}
          {featured && (
            <Link
              href={featured.href}
              className="sd-rise group mx-auto hidden w-full max-w-[19rem] lg:block"
              style={{ '--d': '350ms' } as React.CSSProperties}
            >
              <Arch className="aspect-[3/4]">
                <DishImage product={featured} className="h-full w-full" priority />
              </Arch>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                {t.boardTitle}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-3">
                <span className="font-display text-2xl">{featured.name}</span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: GOLD }}>
                  {formatMoney(featured.price, data.currency)}
                </span>
              </p>
            </Link>
          )}
        </div>
      </section>

      <WaxBand color={hero.primaryColor} />

      {/* ------------------------------------------------- Plats signature
          Rangées alternées : l'arche à gauche, puis à droite. Chacune glisse
          depuis son côté en entrant à l'écran. */}
      {signatures.length > 0 && (
        <section className="py-20 sm:py-28">
          <div className="container-page">
            <div className="flex flex-col items-center text-center">
              <Ornament />
              <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-6xl">{t.boardTitle}</h2>
            </div>

            <ol className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
              {signatures.map((product, index) => {
                const flipped = index % 2 === 1;
                return (
                  <li
                    key={product.id}
                    className="sd-slide grid items-center gap-10 md:grid-cols-2 md:gap-16"
                    style={{ '--sd-from': flipped ? '64px' : '-64px' } as React.CSSProperties}
                  >
                    <Link
                      href={product.href}
                      className={cx('group mx-auto block w-full max-w-[22rem]', flipped && 'md:order-2')}
                    >
                      <Arch className="aspect-[4/5]">
                        <DishImage product={product} className="h-full w-full" />
                      </Arch>
                    </Link>

                    <div className={cx(flipped && 'md:order-1 md:text-end')}>
                      <p
                        aria-hidden="true"
                        className="font-display text-7xl font-semibold leading-none text-transparent sm:text-8xl"
                        style={{ WebkitTextStroke: `1.5px ${GOLD}` }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </p>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                        {product.categoryName}
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                        <Link href={product.href} className="hover:underline hover:underline-offset-8">
                          {product.name}
                        </Link>
                      </h3>
                      {product.description && (
                        <p
                          className={cx('mt-4 max-w-md text-base leading-relaxed', flipped && 'md:ms-auto')}
                          style={{ color: `${PAPER}a6` }}
                        >
                          {product.description}
                        </p>
                      )}
                      {product.orderedCount > 0 && (
                        <p className="mt-3 text-sm" style={{ color: `${PAPER}80` }}>
                          {t.orderedTimes(product.orderedCount)}
                        </p>
                      )}
                      <div className={cx('mt-7 flex flex-wrap items-center gap-5', flipped && 'md:justify-end')}>
                        <span className="font-display text-2xl tabular-nums" style={{ color: GOLD }}>
                          {formatMoney(product.price, data.currency)}
                        </span>
                        {hero.orderingEnabled && (
                          <QuickAddButton
                            product={product}
                            className="inline-flex h-11 items-center rounded-full border px-6 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
                            style={{ borderColor: GOLD, color: PAPER }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Carte
          Sur papier clair, entre deux frises : la carte se lit comme un menu
          imprimé posé sur la table. */}
      <section id="carte" className="bg-surface text-ink">
        <Zigzag className="-translate-y-px" />
        <div className="container-page py-16 sm:py-24">
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ink-muted">{t.sectionMenu}</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">{t.sectionOurMenu}</h2>
            <Ornament className="mt-6" />
          </div>
          <div className="sd-reveal mt-14">
            <Menu categories={data.menuCategories} currency={data.currency} />
          </div>
          <div className="mt-14 flex justify-center">
            <Link
              href={data.menuHref}
              className="group inline-flex h-14 items-center gap-2.5 rounded-full border border-ink px-8 font-semibold transition-colors hover:bg-ink hover:text-surface"
            >
              {dict.menuPage.seeAll}
              <ArrowRight weight="bold" className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
        <Zigzag className="translate-y-px rotate-180" />
      </section>

      {/* ---------------------------------------------------- Histoire, chef */}
      {(hasStory || data.chef) && (
        <section className="py-20 sm:py-28">
          <div
            className={cx(
              'container-page grid gap-14 lg:items-center',
              hasStory && data.chef ? 'lg:grid-cols-[1.3fr_0.7fr]' : 'max-w-4xl',
            )}
          >
            {hasStory && (
              <div>
                <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>
                  <span aria-hidden="true" className="h-px w-10" style={{ backgroundColor: GOLD }} />
                  {t.sectionStory}
                </p>
                <span aria-hidden="true" className="mt-4 block font-display text-8xl leading-[0.6]" style={{ color: GOLD }}>
                  “
                </span>
                <p
                  className="sd-ink mt-2 font-display text-3xl leading-[1.3] sm:text-4xl lg:text-[2.75rem]"
                  style={{ '--ink': PAPER } as React.CSSProperties}
                >
                  {data.story}
                </p>
              </div>
            )}
            {data.chef && (
              <figure className="sd-reveal mx-auto w-full max-w-[18rem]">
                <Arch className="aspect-[3/4]">
                  {data.chef.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                    <img src={data.chef.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <DishPlaceholder name="chef" category="cuisine" />
                  )}
                </Arch>
                <figcaption className="mt-7 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                    {t.sectionChef}
                  </p>
                  <p className="mt-1 font-display text-2xl">{data.chef.name}</p>
                  {data.chef.bio && (
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: `${PAPER}a6` }}>
                      {data.chef.bio}
                    </p>
                  )}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Galerie
          Une rangée d'arches, celle du milieu décalée vers le bas. */}
      {data.gallery.length > 0 && (
        <section className="pb-20 sm:pb-28">
          <div className="container-page">
            <h2 className="text-center font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {t.sectionAmbience}
            </h2>
            <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8">
              {data.gallery.slice(0, 6).map((image, index) => (
                <figure
                  key={image.id}
                  className={cx('sd-reveal group', index % 3 === 1 && 'sm:translate-y-12')}
                >
                  <Arch className="aspect-[3/4]" frame={false}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                    <img
                      src={image.imageUrl}
                      alt={image.caption ?? ''}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </Arch>
                  {image.caption && (
                    <figcaption className="mt-3 text-center text-sm" style={{ color: `${PAPER}99` }}>
                      {image.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Avis */}
      {reviews.length > 0 && (
        <section className="border-t py-20 sm:py-24" style={{ borderColor: `${GOLD}26` }}>
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.sectionTheyTalk}</h2>
              {data.averageRating !== null && (
                <p className="flex items-center gap-2 font-semibold">
                  <Star weight="fill" className="h-5 w-5" style={{ color: GOLD }} />
                  {t.ratingOutOf(data.averageRating.toFixed(1).replace('.', ','), data.reviews.length)}
                </p>
              )}
            </div>
            <ul className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none]">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-[1.75rem] border p-7"
                  style={{ borderColor: `${GOLD}33`, backgroundColor: '#ffffff08' }}
                >
                  <p className="flex gap-1" aria-label={t.ratingSimple(String(review.rating))}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        weight="fill"
                        aria-hidden="true"
                        className="h-4 w-4"
                        style={{ color: i < review.rating ? GOLD : `${PAPER}26` }}
                      />
                    ))}
                  </p>
                  <blockquote className="mt-5 line-clamp-5 font-display text-xl leading-snug">“{review.comment}”</blockquote>
                  <p className="mt-5 text-sm font-semibold" style={{ color: `${PAPER}99` }}>
                    {review.customerName}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Nous trouver */}
      <section className="pb-20 sm:pb-28">
        <div className="container-page grid gap-6 lg:grid-cols-2">
          <div className="sd-reveal rounded-[2rem] bg-surface p-6 text-ink sm:p-9">
            <h2 className="flex items-center gap-3 font-display text-3xl font-semibold tracking-tight">
              <Clock weight="duotone" className="h-7 w-7" style={{ color: 'var(--brand)' }} />
              {t.sectionHours}
            </h2>
            {data.openingHours.length > 0 ? (
              <dl className="mt-6 divide-y divide-surface-border">
                {weekOrder(data.openingHours).map((hour) => {
                  const isToday = hour.dayOfWeek === data.today;
                  return (
                    <div
                      key={hour.dayOfWeek}
                      className={cx('flex items-center justify-between py-2.5 text-sm', isToday ? 'font-semibold' : 'text-ink-muted')}
                    >
                      <dt className="capitalize">
                        {days[hour.dayOfWeek]}
                        {isToday && (
                          <span className="ms-2 text-xs" style={{ color: 'var(--brand)' }}>
                            {t.today}
                          </span>
                        )}
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
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-ink px-5 font-semibold transition-colors hover:bg-ink hover:text-surface"
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

          <div
            className="sd-reveal relative min-h-[18rem] overflow-hidden rounded-[2rem] border"
            style={{ borderColor: `${GOLD}40` }}
          >
            {data.location.mapEmbedSrc ? (
              <iframe
                title={t.mapTitle}
                src={data.location.mapEmbedSrc}
                loading="lazy"
                className="absolute inset-0 h-full w-full grayscale-[40%]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-25"
                style={{ backgroundImage: waxPattern(hero.primaryColor, GOLD), backgroundSize: '72px 72px' }}
              />
            )}
            <div
              className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl p-4 shadow-lg backdrop-blur"
              style={{ backgroundColor: `${NIGHT}e6` }}
            >
              <MapPin weight="fill" className="mt-0.5 h-6 w-6 shrink-0" style={{ color: GOLD }} />
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
                    style={{ color: GOLD }}
                  >
                    {t.viewOnMap}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Appel final
          Le tissu wax en fond, qui glisse : la dernière image de la page. */}
      {hero.orderingEnabled && (
        <section className="relative isolate overflow-hidden py-20 text-center text-white sm:py-28" style={{ backgroundColor: 'var(--brand)' }}>
          <div
            aria-hidden="true"
            className="sd-pattern absolute inset-0 -z-10 opacity-[0.09]"
            style={{
              backgroundImage: waxPattern('#000000', '#ffffff'),
              backgroundSize: '96px 96px',
              '--sd-pattern-speed': '24s',
            } as React.CSSProperties}
          />
          <div className="container-page">
            <Ornament className="justify-center [&>span]:!bg-white" />
            <p className="mx-auto mt-6 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-6xl">{hero.name}</p>
            <p className="mx-auto mt-4 max-w-md text-white/85">{hero.openLabel}</p>
            <Link
              href={hero.menuHref}
              className="group mt-9 inline-flex h-14 items-center gap-2.5 rounded-full px-8 font-semibold transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ backgroundColor: NIGHT, color: PAPER }}
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
