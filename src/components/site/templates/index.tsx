import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { DEFAULT_TEMPLATE_KEY } from '@/lib/templates/registry';

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

function HeroModern({ data }: { data: HeroData }) {
  return (
    <section className="relative overflow-hidden">
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
      <div aria-hidden="true" className="absolute inset-0 bg-black/55" />

      <div className="container-page relative py-20 text-white sm:py-28">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">
          {data.city ?? 'Bienvenue'}
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {data.name}
        </h1>
        {data.description && (
          <p className="mt-4 max-w-xl text-white/85">{data.description}</p>
        )}
        <OpenStatus data={data} className="mt-6" />
        <HeroCta data={data} className="mt-7" />
      </div>
    </section>
  );
}

function HeroAfricanPremium({ data }: { data: HeroData }) {
  return (
    <section className="border-b border-surface-border bg-[#1c1917] text-white">
      <div className="container-page grid gap-8 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span
            aria-hidden="true"
            className="inline-block h-1 w-16 rounded-full"
            style={{ backgroundColor: data.primaryColor }}
          />
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mt-4 max-w-lg text-white/75">{data.description}</p>
          )}
          <OpenStatus data={data} className="mt-6" dark />
          <HeroCta data={data} className="mt-7" />
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          {data.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image de tenant
            <img
              src={data.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full"
              style={{ backgroundColor: data.primaryColor }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function HeroFastFood({ data }: { data: HeroData }) {
  return (
    <section
      className="border-b-4 text-white"
      style={{ backgroundColor: data.primaryColor, borderColor: 'rgba(0,0,0,0.25)' }}
    >
      <div className="container-page py-12 text-center sm:py-16">
        {data.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
          <img
            src={data.logoUrl}
            alt=""
            className="mx-auto mb-5 h-20 w-20 rounded-2xl border-4 border-white/25 object-cover"
          />
        )}
        <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-6xl">
          {data.name}
        </h1>
        {data.description && (
          <p className="mx-auto mt-3 max-w-xl text-white/90">{data.description}</p>
        )}
        <OpenStatus data={data} className="mt-5 justify-center" dark />
        <HeroCta data={data} className="mt-6 justify-center" inverted />
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
              className="inline-flex h-12 items-center rounded-full bg-white px-7 font-medium text-ink transition-transform hover:scale-[1.03]"
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

function HeroElegant({ data }: { data: HeroData }) {
  return (
    <section className="border-b border-surface-border bg-white">
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-5xl font-normal tracking-tight sm:text-6xl">
            {data.name}
          </h1>
          {data.description && (
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
              {data.description}
            </p>
          )}
          <OpenStatus data={data} className="mt-8 justify-center" />
          <HeroCta data={data} className="mt-8 justify-center" />
        </div>

        {data.coverUrl && (
          <div className="mt-14 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
            <img
              src={data.coverUrl}
              alt=""
              className="aspect-[21/9] w-full object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function OpenStatus({
  data,
  className,
  dark,
}: {
  data: HeroData;
  className?: string;
  dark?: boolean;
}) {
  return (
    <p className={cx('flex items-center gap-2 text-sm', className)}>
      <span
        aria-hidden="true"
        className={cx(
          'h-2 w-2 rounded-full',
          data.isOpenNow ? 'bg-emerald-400' : 'bg-red-400',
        )}
      />
      <span className={dark ? 'text-white/80' : undefined}>{data.openLabel}</span>
    </p>
  );
}

function HeroCta({
  data,
  className,
  inverted,
}: {
  data: HeroData;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <div className={cx('flex flex-wrap gap-3', className)}>
      <Link
        href={data.menuHref}
        className={cx(
          'inline-flex h-12 items-center rounded-xl px-6 font-medium transition-opacity hover:opacity-90',
          inverted ? 'bg-white text-ink' : 'text-white',
        )}
        style={inverted ? undefined : { backgroundColor: data.primaryColor }}
      >
        {data.orderingEnabled ? 'Voir le menu et commander' : 'Voir le menu'}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- Menu

function ProductCard({ product, currency }: { product: MenuProduct; currency: string }) {
  const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';

  return (
    <Link
      href={product.href}
      aria-disabled={unavailable || undefined}
      className={cx(
        'group flex gap-4 rounded-2xl border border-surface-border p-3 transition-colors hover:border-ink',
        unavailable && 'opacity-60',
      )}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image de tenant
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-24 w-24 shrink-0 rounded-xl bg-surface-sunken sm:h-28 sm:w-28"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-snug">{product.name}</h3>
          {product.badge !== 'NONE' && BADGE_LABELS[product.badge] && (
            <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {BADGE_LABELS[product.badge]}
            </span>
          )}
        </div>

        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
            {product.description}
          </p>
        )}

        <p className="mt-auto pt-2 text-sm">
          <span className="font-semibold">{formatMoney(product.price, currency)}</span>
          {product.compareAtPrice && (
            <span className="ml-2 text-ink-faint line-through">
              {formatMoney(product.compareAtPrice, currency)}
            </span>
          )}
          {unavailable && (
            <span className="ml-2 text-ink-faint">· Indisponible</span>
          )}
        </p>
      </div>
    </Link>
  );
}

/** Grille à deux colonnes — la présentation par défaut. */
function MenuGrid({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="space-y-12">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2 id={`cat-${category.id}`} className="text-xl font-semibold tracking-tight">
            {category.name}
          </h2>
          {category.description && (
            <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
          )}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {category.products.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Liste en une colonne, à la manière d'une carte imprimée. */
function MenuList({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-12">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="border-b border-surface-border pb-2 font-display text-2xl"
          >
            {category.name}
          </h2>
          <ul className="mt-4 divide-y divide-surface-border">
            {category.products.map((product) => (
              <li key={product.id}>
                <Link
                  href={product.href}
                  className={cx(
                    'flex items-baseline justify-between gap-4 py-3.5 hover:bg-surface-sunken',
                    !product.isAvailable && 'opacity-60',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{product.name}</span>
                    {product.description && (
                      <span className="mt-0.5 block text-sm text-ink-muted">
                        {product.description}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(product.price, currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
          className="sticky top-16 z-10 -mx-4 flex gap-2 overflow-x-auto bg-white/95 px-4 py-3 backdrop-blur"
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
    <Link
      href={product.href}
      aria-disabled={unavailable || undefined}
      className={cx(
        'group overflow-hidden rounded-2xl border border-surface-border transition-shadow hover:shadow-lg',
        unavailable && 'opacity-60',
      )}
    >
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
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
            {BADGE_LABELS[product.badge]}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug">{product.name}</h3>
          <span className="shrink-0 font-semibold" style={{ color: 'var(--brand)' }}>
            {formatMoney(product.price, currency)}
          </span>
        </div>
        {product.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{product.description}</p>
        )}
        {product.compareAtPrice && (
          <p className="mt-1 text-xs text-ink-faint line-through">
            {formatMoney(product.compareAtPrice, currency)}
          </p>
        )}
        {unavailable && <p className="mt-1 text-xs text-ink-faint">Indisponible</p>}
      </div>
    </Link>
  );
}

/** Cartes larges avec grande image — mise en avant du visuel. */
function MenuShowcase({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  return (
    <div className="space-y-12">
      {categories.map((category) => (
        <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2
            id={`cat-${category.id}`}
            className="text-xl font-bold uppercase tracking-tight"
          >
            {category.name}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((product) => (
              <Link
                key={product.id}
                href={product.href}
                className={cx(
                  'overflow-hidden rounded-2xl border border-surface-border transition-colors hover:border-ink',
                  !product.isAvailable && 'opacity-60',
                )}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                  <img
                    src={product.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="aspect-[4/3] w-full bg-surface-sunken" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{product.name}</h3>
                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                      {product.description}
                    </p>
                  )}
                  <p className="mt-3 font-bold">
                    {formatMoney(product.price, currency)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
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
  modern: { Hero: HeroModern, Menu: MenuGrid },
  'african-premium': { Hero: HeroAfricanPremium, Menu: MenuGrid },
  'fast-food': { Hero: HeroFastFood, Menu: MenuShowcase },
  traditional: { Hero: HeroTraditional, Menu: MenuTraditional },
  elegant: { Hero: HeroElegant, Menu: MenuList },
};

/** Un template inconnu retombe sur le template par défaut plutôt que d'échouer. */
export function templateRenderer(key: string): TemplateRenderer {
  return TEMPLATE_RENDERERS[key] ?? TEMPLATE_RENDERERS[DEFAULT_TEMPLATE_KEY]!;
}
