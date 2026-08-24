'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

/**
 * Grille de produits avec recherche côté client — la liste est déjà chargée
 * par la page serveur (catalogue d'une boutique, quelques centaines de
 * références au plus), pas besoin d'une recherche paginée côté serveur pour
 * cette première version.
 */
export function ProductGrid({
  products,
  host,
  currency,
  locale,
}: {
  products: Product[];
  host: string;
  currency: string;
  locale: string;
}) {
  const [query, setQuery] = useState('');
  const dict = getBoutiqueSiteDictionary(locale);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => p.name.toLowerCase().includes(needle));
  }, [products, query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={dict.searchPlaceholder}
        className="mb-6 h-11 w-full rounded-xl border border-gray-300 px-4 text-sm focus:border-gray-500 focus:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{dict.noSearchResults}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <Link
              key={product.id}
              href={`${sitePathBase(host)}/produits/${product.id}`}
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
                {formatMoney(product.price, currency)}
                {product.unit !== 'UNIT' && (
                  <span className="text-gray-400"> / {UNIT_LABELS[product.unit]}</span>
                )}
              </p>
              {product.stock <= 0 && (
                <p className="mt-0.5 text-xs font-medium text-red-600">{dict.outOfStock}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
