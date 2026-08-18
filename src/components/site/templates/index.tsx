import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { DEFAULT_TEMPLATE_KEY } from '@/lib/templates/registry';
import { QuickAddButton } from '@/components/site/quick-add-button';

/**
 * Rendus de templates.
 *
 * Chaque template est un couple (héros, mise en page du menu) travaillant sur
 * des données identiques. Aucun ne possède de champ propre : c'est ce qui
 * permet de changer de template sans migration ni perte.
 *
 * Ajouter un template : écrire son héros et sa grille, puis l'inscrire dans
 * `TEMPLATE_RENDERERS`.
 */

export type HeroData = {
  name: string;
  description: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  city: string | null;
  addressLine: string | null;
  phone: string | null;
  primaryColor: string;
  isOpenNow: boolean;
  openLabel: string;
  menuHref: string;
  infosHref: string;
  orderingEnabled: boolean;
};

export type MenuProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  isAvailable: boolean;
  badge: string;
  href: string;
  /** Variantes ou options à choisir : l'ajout rapide devient un lien vers la fiche. */
  hasOptions: boolean;
};

export type MenuCategoryData = {
  id: string;
  name: string;
  description: string | null;
  products: MenuProduct[];
};

const BADGE_LABELS: Record<string, string> = {
  POPULAR: 'Populaire',
  NEW: 'Nouveau',
  PROMOTION: 'Promotion',
  SOLD_OUT: 'Épuisé',
};

// --------------------------------------------------------------------- Héros

/**
 * Bento éditorial : deux volets asymétriques, halo de couleur en fond, badge
 * de statut flottant sur la photo. Le langage visuel dominant du web produit
 * moderne (2025-2026) — typographie surdimensionnée, formes douces, calme.
 */
function HeroModern({ data }: { data: HeroData }) {
  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:py-24">
        <div className="relative z-10">
          <div
            aria-hidden="true"
            className="absolute -left-20 -top-20 -z-10 h-72 w-72 rounded-full opacity-[0.14] blur-3xl lg:h-96 lg:w-96"
            style={{ backgroundColor: data.primaryColor }}
          />
          {data.city && (
            <p className="inline-flex items-center gap-2 rounded-full border border-surface-border px-3 py-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
              <span
                aria-hidden="true"
                className={cx('h-1.5 w-1.5 rounded-full', data.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
              />
              {data.city}
            </p>
          )}
          <h1 className="mt-5 text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mt-5 max-w-md text-lg text-ink-muted">{data.description}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href={data.menuHref}
              className="inline-flex h-14 items-center gap-2 rounded-full px-7 font-semibold text-white transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: data.primaryColor }}
            >
              {data.orderingEnabled ? 'Commander maintenant' : 'Voir le menu'}
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={data.infosHref}
              className="text-sm font-medium text-ink underline decoration-surface-border underline-offset-4 hover:decoration-ink"
            >
              Infos pratiques
            </Link>
          </div>
        </div>

        <div className="relative mt-4 lg:mt-0">
          <div className="aspect-[4/5] overflow-hidden rounded-[2rem] lg:aspect-square">
            {data.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image de tenant
              <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                aria-hidden="true"
                className="h-full w-full"
                style={{ backgroundColor: data.primaryColor }}
              />
            )}
          </div>
          <div className="absolute -bottom-5 left-5 flex items-center gap-2 rounded-2xl border border-surface-border bg-surface/90 px-4 py-3 text-sm shadow-lg backdrop-blur">
            <span
              aria-hidden="true"
              className={cx('h-2 w-2 rounded-full', data.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
            />
            {data.openLabel}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Éditorial doré : fond sombre texturé (motif de points, très discret),
 * cadre décalé autour de la photo, typographie serif à large espacement.
 * Le vocabulaire du restaurant premium — retenue plutôt qu'ostentation.
 */
function HeroAfricanPremium({ data }: { data: HeroData }) {
  return (
    <section className="relative overflow-hidden border-b border-black/20 bg-[#1c1512] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="container-page relative grid gap-10 py-20 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p
            className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em]"
            style={{ color: data.primaryColor }}
          >
            <span aria-hidden="true" className="h-px w-10" style={{ backgroundColor: data.primaryColor }} />
            {data.city ?? 'Bienvenue'}
          </p>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mt-5 max-w-lg text-lg text-white/70">{data.description}</p>
          )}
          <p className="mt-8 flex items-center gap-2 text-sm text-white/60">
            <span
              aria-hidden="true"
              className={cx('h-2 w-2 rounded-full', data.isOpenNow ? 'bg-emerald-400' : 'bg-red-400')}
            />
            {data.openLabel}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={data.menuHref}
              className="inline-flex h-14 items-center rounded-full px-8 font-semibold text-[#1c1512] transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: data.primaryColor }}
            >
              {data.orderingEnabled ? 'Découvrir la carte' : 'Voir le menu'}
            </Link>
            <Link
              href={data.infosHref}
              className="inline-flex h-14 items-center rounded-full border border-white/25 px-8 font-medium text-white transition-colors hover:bg-white/5"
            >
              Nous trouver
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem]">
            {data.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image de tenant
              <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                aria-hidden="true"
                className="h-full w-full"
                style={{ backgroundColor: data.primaryColor }}
              />
            )}
          </div>
          <span
            aria-hidden="true"
            className="absolute -inset-3 -z-10 rounded-[2rem] border"
            style={{ borderColor: data.primaryColor, opacity: 0.4 }}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Néo-brutaliste, énergique : blocs de couleur pleine teinte, ombres portées
 * décalées façon autocollant, bouton XXL. Le registre visuel du street-food
 * et du fast-casual 2025-2026 — direct, ludique, impossible à ignorer.
 */
function HeroFastFood({ data }: { data: HeroData }) {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={data.coverUrl ? undefined : { backgroundColor: data.primaryColor }}
    >
      {data.coverUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire */}
          <img
            src={data.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Teinte de la couleur du restaurant plutôt qu'un voile noir
              générique : l'identité « bloc de couleur pleine teinte » du
              template survit même quand une photo remplace le fond. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: data.primaryColor, opacity: 0.72 }}
          />
        </>
      )}
      <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

      <div className="container-page relative flex flex-col items-center gap-6 py-16 text-center sm:py-20">
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
          <img
            src={data.logoUrl}
            alt=""
            className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-[6px_6px_0_rgba(0,0,0,0.25)]"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-black/10 text-3xl font-black">
            {data.name.charAt(0).toUpperCase()}
          </span>
        )}

        <h1 className="max-w-2xl text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          {data.name}
        </h1>
        {data.description && (
          <p className="max-w-lg text-lg font-medium text-white/90">{data.description}</p>
        )}

        <span className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_rgba(255,255,255,0.3)]">
          <span
            aria-hidden="true"
            className={cx('h-2 w-2 rounded-full', data.isOpenNow ? 'bg-emerald-400' : 'bg-red-400')}
          />
          {data.openLabel}
        </span>

        <Link
          href={data.menuHref}
          className="mt-2 inline-flex h-16 items-center rounded-full bg-black px-10 text-lg font-black uppercase tracking-wide text-white shadow-[6px_6px_0_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 hover:shadow-[8px_8px_0_rgba(0,0,0,0.3)]"
        >
          {data.orderingEnabled ? 'Commander maintenant' : 'Voir le menu'}
        </Link>
      </div>
    </section>
  );
}

/**
 * Héros plein cadre, à la manière d'une carte de restaurant photographiée en
 * salle : la photo porte l'ambiance, le texte reste minimal et lisible grâce
 * à un dégradé plutôt qu'un voile uniforme (qui aplatirait l'image).
 */
function HeroTraditional({ data }: { data: HeroData }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#1c1712]">
      <div className="relative h-[78vh] min-h-[560px] w-full">
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire
          <img
            src={data.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: data.primaryColor }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
        />

        <div className="container-page relative flex h-full flex-col justify-end pb-14 text-white sm:pb-20">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo de tenant
            <img
              src={data.logoUrl}
              alt=""
              className="mb-6 h-14 w-14 rounded-full border-2 border-white/40 object-cover"
            />
          )}
          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mt-5 max-w-xl text-lg text-white/85">{data.description}</p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={data.menuHref}
              className="inline-flex h-12 items-center rounded-full bg-white px-7 font-medium text-black transition-transform hover:scale-[1.03]"
            >
              {data.orderingEnabled ? 'Voir le menu et commander' : 'Voir le menu'}
            </Link>
            <Link
              href={data.infosHref}
              className="inline-flex h-12 items-center rounded-full border border-white/50 px-7 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Nous trouver
            </Link>
          </div>
        </div>
      </div>

      <TraditionalInfoStrip data={data} />
    </section>
  );
}

/**
 * Bandeau d'informations pratiques, ancré au bas du héros : horaires,
 * adresse et téléphone d'un coup d'œil, sans avoir à chercher la page
 * « Infos ». Repose sur `primaryColor` plutôt qu'une couleur fixe : le
 * template doit fonctionner pour n'importe quelle identité de restaurant.
 */
type InfoStripItem = { label: string; live?: boolean; href?: string };

function TraditionalInfoStrip({ data }: { data: HeroData }) {
  const items: InfoStripItem[] = [{ label: data.openLabel, live: true }];

  if (data.addressLine) {
    items.push({ label: [data.addressLine, data.city].filter(Boolean).join(', ') });
  }
  if (data.phone) {
    items.push({ label: data.phone, href: `tel:${data.phone}` });
  }

  return (
    <div className="border-t border-white/10 bg-[#15110d]">
      <div className="container-page flex flex-wrap items-center gap-x-8 gap-y-3 py-4 text-sm text-white/80">
        {items.map((item, index) => {
          const content = (
            <span className="flex items-center gap-2">
              {item.live && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-2 w-2 rounded-full',
                    data.isOpenNow ? 'bg-emerald-400' : 'bg-red-400',
                  )}
                />
              )}
              {item.label}
            </span>
          );
          return item.href ? (
            <a key={index} href={item.href} className="transition-colors hover:text-white">
              {content}
            </a>
          ) : (
            <span key={index}>{content}</span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Minimalisme haute couture : initiale du restaurant en filigrane géant,
 * bouton à angles droits, silence typographique. La retenue devient elle-même
 * le signe de standing — l'inverse du bruit visuel des autres templates.
 */
function HeroElegant({ data }: { data: HeroData }) {
  return (
    <section className="relative overflow-hidden bg-surface">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[24rem] font-semibold leading-none text-surface-sunken sm:text-[32rem]"
      >
        {data.name.charAt(0).toUpperCase()}
      </span>

      <div className="container-page relative py-24 sm:py-32">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-ink-faint">
            {data.city ?? 'Restaurant'}
          </p>
          <h1 className="mt-6 font-display text-6xl font-normal tracking-tight sm:text-7xl">
            {data.name}
          </h1>
          <span aria-hidden="true" className="mx-auto mt-8 block h-px w-16 bg-ink/20" />
          {data.description && (
            <p className="mx-auto mt-8 max-w-md text-lg leading-relaxed text-ink-muted">
              {data.description}
            </p>
          )}
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href={data.menuHref}
              className="inline-flex h-14 items-center rounded-none border border-ink px-10 text-sm font-medium uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-surface"
            >
              {data.orderingEnabled ? 'Réserver ou commander' : 'Voir le menu'}
            </Link>
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              <span
                aria-hidden="true"
                className={cx('h-1.5 w-1.5 rounded-full', data.isOpenNow ? 'bg-emerald-500' : 'bg-red-500')}
              />
              {data.openLabel}
            </p>
          </div>
        </div>

        {data.coverUrl && (
          <div className="relative mt-16 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
            <img src={data.coverUrl} alt="" className="aspect-[21/9] w-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Menu

/**
 * Bento : le premier produit de chaque catégorie occupe une tuile large
 * (photo pleine tuile, texte en surimpression), les suivants une tuile
 * simple — une hiérarchie visuelle immédiate sans avoir à l'expliquer.
 */
function MenuBento({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="space-y-16">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2 id={`cat-${category.id}`} className="text-2xl font-bold tracking-tight">
            {category.name}
          </h2>
          {category.description && (
            <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
          )}
          <div className="mt-6 grid auto-rows-[170px] grid-cols-2 gap-4 sm:auto-rows-[190px] sm:grid-cols-4">
            {category.products.map((product, index) => (
              <BentoProductCard
                key={product.id}
                product={product}
                currency={currency}
                featured={index === 0}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BentoProductCard({
  product,
  currency,
  featured,
}: {
  product: MenuProduct;
  currency: string;
  featured: boolean;
}) {
  const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-2xl bg-surface-sunken',
        featured && 'col-span-2 row-span-2',
        unavailable && 'opacity-60',
      )}
    >
      <Link href={product.href} aria-disabled={unavailable || undefined} className="absolute inset-0">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
        />
        {product.badge !== 'NONE' && BADGE_LABELS[product.badge] && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black">
            {BADGE_LABELS[product.badge]}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className={cx('font-semibold leading-snug', featured ? 'text-lg' : 'text-sm')}>
            {product.name}
          </h3>
          {featured && product.description && (
            <p className="mt-1 line-clamp-2 text-sm text-white/80">{product.description}</p>
          )}
          <p className={cx('mt-1 font-bold', featured ? 'text-base' : 'text-sm')}>
            {formatMoney(product.price, currency)}
          </p>
        </div>
      </Link>

      <QuickAddButton
        product={product}
        className="absolute right-2 top-2 z-10 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black shadow-sm transition-colors hover:bg-white"
      />
    </div>
  );
}

/**
 * Liste numérotée à la manière d'une carte de restaurant gastronomique :
 * chiffre en filigrane, filet pointillé entre le nom et le prix, vignette
 * photo quand le plat en a une (sans photo, la mise en page reste intacte).
 */
function MenuNumbered({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-14">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint"
          >
            {category.name}
          </h2>
          <ul className="mt-5 space-y-5">
            {category.products.map((product, index) => (
              <li
                key={product.id}
                className={cx('flex items-start gap-4', !product.isAvailable && 'opacity-60')}
              >
                <Link href={product.href} className="group flex min-w-0 flex-1 items-start gap-4">
                  <span className="mt-1 font-display text-sm text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {product.imageUrl && (
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                      {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-display text-lg font-medium">{product.name}</h3>
                      <span
                        aria-hidden="true"
                        className="mb-1 h-px flex-1 border-t border-dotted border-surface-border"
                      />
                    </div>
                    {product.description && (
                      <p className="mt-1 text-sm text-ink-muted">{product.description}</p>
                    )}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-semibold">{formatMoney(product.price, currency)}</span>
                  <QuickAddButton
                    product={product}
                    className="text-xs font-medium uppercase tracking-wide text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Colonne unique, silencieuse : nom et prix seuls, sans image ni bordure. */
function MenuElegant({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-16">
      {categories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          aria-labelledby={`cat-${category.id}`}
          className="text-center"
        >
          <h2
            id={`cat-${category.id}`}
            className="text-xs font-semibold uppercase tracking-[0.4em] text-ink-faint"
          >
            {category.name}
          </h2>
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
                    <span aria-hidden="true" className="h-24 w-24 shrink-0 rounded-full bg-surface-sunken" />
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
        </section>
      ))}
    </div>
  );
}

/**
 * Pastilles de catégories (ancres vers chaque section) + cartes produit avec
 * photo, description et prix en couleur de marque. Les pastilles n'ont
 * d'intérêt qu'à partir de deux catégories — l'aperçu d'accueil n'en affiche
 * généralement qu'une ou deux, la page menu complète en profite pleinement.
 */
function MenuTraditional({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="space-y-14">
      {categories.length > 1 && (
        <nav
          aria-label="Catégories du menu"
          className="sticky top-16 z-10 -mx-4 flex gap-2 overflow-x-auto bg-surface/95 px-4 py-3 backdrop-blur"
        >
          {categories.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}`}
              className="shrink-0 rounded-full border border-surface-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="font-display text-2xl font-semibold tracking-tight"
          >
            {category.name}
          </h2>
          {category.description && (
            <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((product) => (
              <TraditionalProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TraditionalProductCard({
  product,
  currency,
}: {
  product: MenuProduct;
  currency: string;
}) {
  const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';

  return (
    <div
      className={cx(
        'group overflow-hidden rounded-2xl border border-surface-border transition-shadow hover:shadow-lg',
        unavailable && 'opacity-60',
      )}
    >
      <Link href={product.href} aria-disabled={unavailable || undefined}>
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image de tenant
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div aria-hidden="true" className="h-full w-full" />
          )}
          {product.badge !== 'NONE' && BADGE_LABELS[product.badge] && (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-black shadow-sm">
              {BADGE_LABELS[product.badge]}
            </span>
          )}
        </div>

        <div className="p-4 pb-0">
          <h3 className="font-medium leading-snug">{product.name}</h3>
          {product.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{product.description}</p>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between gap-3 p-4 pt-3">
        <div>
          <span className="font-semibold" style={{ color: 'var(--brand)' }}>
            {formatMoney(product.price, currency)}
          </span>
          {product.compareAtPrice && (
            <span className="ml-2 text-xs text-ink-faint line-through">
              {formatMoney(product.compareAtPrice, currency)}
            </span>
          )}
          {unavailable && <span className="ml-2 text-xs text-ink-faint">Indisponible</span>}
        </div>
        <QuickAddButton
          product={product}
          className="shrink-0 rounded-full border border-surface-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-ink"
        />
      </div>
    </div>
  );
}

/**
 * Cartes contour épais + prix en pastille décalée façon autocollant :
 * le même vocabulaire ludique que le héros, jusque dans la carte.
 */
function MenuFastFood({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="space-y-14">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="inline-block -rotate-1 rounded-xl bg-ink px-4 py-1.5 text-lg font-black uppercase tracking-tight text-surface"
          >
            {category.name}
          </h2>
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((product) => (
              <FastFoodProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FastFoodProductCard({
  product,
  currency,
}: {
  product: MenuProduct;
  currency: string;
}) {
  const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-3xl border-2 border-ink bg-surface transition-transform hover:-translate-y-1',
        unavailable && 'opacity-60',
      )}
    >
      <Link href={product.href} aria-disabled={unavailable || undefined}>
        <div className="relative aspect-square overflow-hidden bg-surface-sunken">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image de tenant
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          {product.badge !== 'NONE' && BADGE_LABELS[product.badge] && (
            <span className="absolute left-2 top-2 -rotate-3 rounded-full bg-black px-2.5 py-1 text-xs font-bold uppercase text-white">
              {BADGE_LABELS[product.badge]}
            </span>
          )}
          <span className="absolute -bottom-3 right-3 rotate-2 rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black text-black shadow-[3px_3px_0_rgba(0,0,0,0.15)]">
            {formatMoney(product.price, currency)}
          </span>
        </div>
        <div className="p-4 pb-3 pt-6">
          <h3 className="font-black uppercase leading-snug">{product.name}</h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{product.description}</p>
          )}
          {unavailable && <p className="mt-1 text-xs text-ink-faint">Indisponible</p>}
        </div>
      </Link>

      <div className="px-4 pb-4">
        <QuickAddButton
          product={product}
          className="flex h-9 w-full items-center justify-center rounded-full bg-ink text-xs font-black uppercase tracking-wide text-surface transition-transform hover:-translate-y-0.5"
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Registre

type TemplateRenderer = {
  Hero: (props: { data: HeroData }) => React.ReactElement;
  Menu: (props: {
    categories: MenuCategoryData[];
    currency: string;
  }) => React.ReactElement;
};

const TEMPLATE_RENDERERS: Record<string, TemplateRenderer> = {
  modern: { Hero: HeroModern, Menu: MenuBento },
  'african-premium': { Hero: HeroAfricanPremium, Menu: MenuNumbered },
  'fast-food': { Hero: HeroFastFood, Menu: MenuFastFood },
  traditional: { Hero: HeroTraditional, Menu: MenuTraditional },
  elegant: { Hero: HeroElegant, Menu: MenuElegant },
  // La page d'accueil de « street-food » est une page unique dédiée
  // (`street-food-home.tsx`, comme « elegant ») ; ce couple ne sert que pour
  // sa page `/menu` complète, dans le même registre visuel que « fast-food ».
  'street-food': { Hero: HeroFastFood, Menu: MenuFastFood },
  // Même principe pour « prestige » (`prestige-home.tsx`) : sa page `/menu`
  // complète reprend le registre visuel de « elegant », le plus proche.
  prestige: { Hero: HeroElegant, Menu: MenuElegant },
};

/** Un template inconnu retombe sur le template par défaut plutôt que d'échouer. */
export function templateRenderer(key: string): TemplateRenderer {
  return TEMPLATE_RENDERERS[key] ?? TEMPLATE_RENDERERS[DEFAULT_TEMPLATE_KEY]!;
}
