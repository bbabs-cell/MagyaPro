import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { loadDeliveryZones, resolvePublicRestaurant } from '@/lib/site/resolve';
import { availableProvidersFor } from '@/lib/payments/registry';
import { CheckoutFlow } from '@/components/site/checkout-flow';

type Props = { params: Promise<{ host: string }> };

export const metadata: Metadata = {
  title: 'Panier',
  robots: { index: false, follow: false },
};

export default async function CartPage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const settings = restaurant.settings;
  const zones = await loadDeliveryZones(restaurant.id);

  // Les moyens de paiement proposés sont calculés côté serveur, à partir de ce
  // que le restaurant a activé *et* de ce qui est réellement opérationnel.
  const providers = availableProvidersFor({
    enabledIds: settings?.paymentProviders ?? [],
    currency: restaurant.currency,
  }).map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
  }));

  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Votre commande
      </h1>

      <div className="mt-6">
        <CheckoutFlow
          host={host}
          restaurantId={restaurant.id}
          currency={restaurant.currency}
          orderingEnabled={settings?.orderingEnabled ?? true}
          deliveryEnabled={settings?.deliveryEnabled ?? true}
          pickupEnabled={settings?.pickupEnabled ?? true}
          minOrderAmount={settings?.minOrderAmount ?? 0}
          prepTimeMinutes={settings?.prepTimeMinutes ?? 30}
          zones={zones}
          providers={providers}
        />
      </div>
    </div>
  );
}
