import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';
import { CheckoutFlow } from '@/components/site-store/checkout-flow';

export const metadata: Metadata = { title: 'Panier' };

export default async function StoreCartPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  const dict = getBoutiqueSiteDictionary(store.language);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.cart}</h1>
      <CheckoutFlow storeId={store.id} host={host} currency={store.currency} locale={store.language} />
    </div>
  );
}
