import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Panier</h1>
      <CheckoutFlow storeId={store.id} host={host} currency={store.currency} />
    </div>
  );
}
