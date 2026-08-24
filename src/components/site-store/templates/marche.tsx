import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import type { StoreHeroProps, StoreProductGridProps } from './types';

/** Template « Marché » — liste compacte façon étal, prix en avant (alimentation, épicerie). */
export function MarcheHero({ store, categories, base, dict }: StoreHeroProps) {
  return (
    <>
      <section className="border-b-4 border-[var(--brand)] bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">
            {dict.businessTypes[store.businessType] ?? dict.businessTypes.OTHER}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{store.name}</h1>
          {store.description && <p className="mt-2 max-w-xl text-gray-700">{store.description}</p>}
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-700">
            {store.addressLine && <span>📍 {store.addressLine}</span>}
            {store.phone && (
              <a href={`tel:${store.phone}`} className="font-semibold text-gray-900">
                ☎ {store.phone}
              </a>
            )}
          </div>
          <Link
            href={`${base}/produits`}
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-[var(--brand)] px-6 text-sm font-bold text-white hover:brightness-90"
          >
            {dict.viewCatalog}
          </Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/produits?categorie=${category.id}`}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-[var(--brand)]/10"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function MarcheProductGrid({ store, products, base, dict }: StoreProductGridProps) {
  const featured = products.slice(0, 15);

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{dict.noProductsYet}</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {featured.map((product) => (
              <li key={product.id}>
                <Link
                  href={`${base}/produits/${product.id}`}
                  className="flex items-center gap-4 p-3 hover:bg-[var(--brand)]/5"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-gray-300">
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{product.name}</p>
                    {product.unit !== 'UNIT' && (
                      <p className="text-xs text-gray-500">Vendu au {UNIT_LABELS[product.unit]}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-lg font-bold text-[var(--brand)]">
                    {formatMoney(product.price, store.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
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
