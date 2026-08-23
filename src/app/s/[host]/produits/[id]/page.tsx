import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { formatMoney } from '@/lib/money';
import { UNIT_LABELS } from '@/lib/boutique/units';
import { loadPublicProduct, resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { AddToCart } from '@/components/site-store/add-to-cart';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; id: string }>;
}): Promise<Metadata> {
  const { host, id } = await params;
  const store = await resolvePublicStore(host);
  if (!store) return {};
  const product = await loadPublicProduct(store.id, id);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description ?? `${product.name} — ${store.name}`,
  };
}

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ host: string; id: string }>;
}) {
  const { host, id } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  const product = await loadPublicProduct(store.id, id);
  if (!product) notFound();

  const inStock = product.stock > 0;
  const attributeEntries = Object.entries(product.attributes);

  const contactMessage = encodeURIComponent(`Bonjour, je suis intéressé(e) par « ${product.name} ».`);
  const whatsappHref = store.phone
    ? `https://wa.me/${store.phone.replace(/[^0-9+]/g, '')}?text=${contactMessage}`
    : null;

  const base = sitePathBase(host);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href={`${base}/produits`} className="text-sm text-gray-500 hover:text-gray-800">
        ← Catalogue
      </Link>

      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl text-gray-300">
              {product.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {product.category.name}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{product.name}</h1>
          {product.brand && <p className="mt-1 text-sm text-gray-500">{product.brand.name}</p>}

          <p className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {formatMoney(product.price, store.currency)}
            </span>
            {product.compareAtPrice && (
              <span className="text-sm text-gray-400 line-through">
                {formatMoney(product.compareAtPrice, store.currency)}
              </span>
            )}
            {product.unit !== 'UNIT' && (
              <span className="text-sm text-gray-500">/ {UNIT_LABELS[product.unit]}</span>
            )}
          </p>

          <p className={`mt-2 text-sm font-medium ${inStock ? 'text-emerald-700' : 'text-red-600'}`}>
            {inStock ? 'En stock' : 'Rupture de stock'}
          </p>

          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-gray-600">{product.description}</p>
          )}

          {attributeEntries.length > 0 && (
            <dl className="mt-4 space-y-1 text-sm">
              {attributeEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="text-gray-500">{key} :</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {inStock && (
            <AddToCart
              product={{
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                unit: product.unit,
                price: product.price,
                stock: product.stock,
              }}
              host={host}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50"
              >
                Appeler la boutique
              </a>
            )}
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
