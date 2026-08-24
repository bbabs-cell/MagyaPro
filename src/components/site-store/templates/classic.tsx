import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import type { StoreHeroProps, StoreProductGridProps } from './types';

/** Template « Classique » — épuré et polyvalent, mise en page d'origine du site public. */
export function ClassicHero({ store, categories, base, dict }: StoreHeroProps) {
  return (
    <>
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {dict.businessTypes[store.businessType] ?? dict.businessTypes.OTHER}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{store.name}</h1>
          {store.description && <p className="mt-3 max-w-2xl text-gray-600">{store.description}</p>}

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-600">
            {store.addressLine && <span>{store.addressLine}</span>}
            {store.phone && (
              <a href={`tel:${store.phone}`} className="font-medium text-gray-900 underline underline-offset-2">
                {store.phone}
              </a>
            )}
          </div>

          <Link
            href={`${base}/produits`}
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
          >
            {dict.viewCatalog}
          </Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/produits?categorie=${category.id}`}
                className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:border-gray-400"
              >
                {category.name}
                <span className="ml-1.5 text-gray-400">{category._count.products}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ClassicProductGrid({ store, products, base, dict }: StoreProductGridProps) {
  const featured = products.slice(0, 8);

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{dict.noProductsYet}</p>
      ) : (
        <>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{dict.products}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <Link
                key={product.id}
                href={`${base}/produits/${product.id}`}
                className="group rounded-2xl border border-gray-200 p-3 transition-shadow hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{product.name}</p>
                <p className="text-sm text-gray-600">
                  {formatMoney(product.price, store.currency)}
                  {product.unit !== 'UNIT' && <span className="text-gray-400"> / {UNIT_LABELS[product.unit]}</span>}
                </p>
              </Link>
            ))}
          </div>
          {products.length > featured.length && (
            <div className="mt-8 text-center">
              <Link
                href={`${base}/produits`}
                className="inline-flex h-11 items-center rounded-xl border border-gray-300 px-6 text-sm font-medium hover:bg-gray-50"
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
