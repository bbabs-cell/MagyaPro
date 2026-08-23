import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { loadPublicCategories, loadPublicProducts, resolvePublicStore } from '@/lib/boutique/site/resolve';
import { ProductGrid } from '@/components/site-store/product-grid';

export const metadata: Metadata = { title: 'Catalogue' };

export default async function StoreCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { host } = await params;
  const { categorie } = await searchParams;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  const [categories, products] = await Promise.all([
    loadPublicCategories(store.id),
    loadPublicProducts(store.id, categorie),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>

      {categories.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/s/${host}/produits`}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              !categorie ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}
          >
            Tout
          </a>
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/s/${host}/produits?categorie=${category.id}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                categorie === category.id
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400'
              }`}
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-6">
        <ProductGrid products={products} host={host} currency={store.currency} />
      </div>
    </div>
  );
}
