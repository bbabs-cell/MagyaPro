import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import type { StoreHeroProps, StoreProductGridProps } from './types';

/** Template « Mode » — grandes photos, mise en avant du visuel (habillement, accessoires). */
export function ModeHero({ store, categories, base, dict }: StoreHeroProps) {
  return (
    <>
      <section className="relative overflow-hidden bg-black text-white">
        {store.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
          <img src={store.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
        )}
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/60">
            {dict.businessTypes[store.businessType] ?? dict.businessTypes.OTHER}
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-6xl">{store.name}</h1>
          {store.description && (
            <p className="mx-auto mt-4 max-w-xl text-white/70">{store.description}</p>
          )}
          <Link
            href={`${base}/produits`}
            className="mt-8 inline-flex h-12 items-center rounded-full border border-[var(--brand)] px-8 text-sm font-medium tracking-wide text-white hover:bg-[var(--brand)]"
          >
            {dict.viewCatalog}
          </Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap justify-center gap-6 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
            {categories.map((category) => (
              <Link key={category.id} href={`${base}/produits?categorie=${category.id}`} className="hover:text-[var(--brand)]">
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ModeProductGrid({ store, products, base, dict }: StoreProductGridProps) {
  const featured = products.slice(0, 6);

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{dict.noProductsYet}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {featured.map((product) => (
              <Link key={product.id} href={`${base}/produits/${product.id}`} className="group">
                <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-gray-300">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm font-medium tracking-wide">{product.name}</p>
                <p className="text-sm text-[var(--brand)]">
                  {formatMoney(product.price, store.currency)}
                  {product.unit !== 'UNIT' && <span> / {UNIT_LABELS[product.unit]}</span>}
                </p>
              </Link>
            ))}
          </div>
          {products.length > featured.length && (
            <div className="mt-10 text-center">
              <Link
                href={`${base}/produits`}
                className="inline-flex h-11 items-center border-b border-[var(--brand)] text-sm font-medium tracking-wide text-[var(--brand)]"
              >
                {dict.viewFullCatalog}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
