import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import type { StoreHeroProps, StoreProductGridProps } from './types';

/** Template « Vitrine » — grille dense, prix visibles (électronique, large catalogue). */
export function VitrineHero({ store, categories, base, dict }: StoreHeroProps) {
  return (
    <>
      <section className="border-b border-blue-100 bg-blue-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {dict.businessTypes[store.businessType] ?? dict.businessTypes.OTHER}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{store.name}</h1>
              {store.description && <p className="mt-2 max-w-xl text-sm text-gray-600">{store.description}</p>}
            </div>
            <Link
              href={`${base}/produits`}
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-blue-700 px-6 text-sm font-medium text-white hover:bg-blue-800"
            >
              {dict.viewCatalog}
            </Link>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="border-b border-gray-100 bg-white">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/produits?categorie=${category.id}`}
                className="shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-700"
              >
                {category.name} <span className="text-gray-400">({category._count.products})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function VitrineProductGrid({ store, products, base, dict }: StoreProductGridProps) {
  const featured = products.slice(0, 12);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{dict.noProductsYet}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {featured.map((product) => (
              <Link
                key={product.id}
                href={`${base}/produits/${product.id}`}
                className="group rounded-lg border border-gray-200 bg-white p-2.5 transition-colors hover:border-blue-400"
              >
                <div className="aspect-square overflow-hidden rounded-md bg-gray-50">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug">{product.name}</p>
                <p className="mt-1 text-sm font-semibold text-blue-700">
                  {formatMoney(product.price, store.currency)}
                  {product.unit !== 'UNIT' && (
                    <span className="text-xs font-normal text-gray-400"> / {UNIT_LABELS[product.unit]}</span>
                  )}
                </p>
              </Link>
            ))}
          </div>
          {products.length > featured.length && (
            <div className="mt-8 text-center">
              <Link
                href={`${base}/produits`}
                className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-6 text-sm font-medium hover:bg-gray-50"
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
