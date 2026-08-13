import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { ReservationForm } from '@/components/site/reservation-form';

type Props = { params: Promise<{ host: string }> };

export const metadata: Metadata = {
  title: 'Réserver une table',
  robots: { index: false, follow: false },
};

export default async function ReservationPage({ params }: Props) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const entitlements = await getEntitlements(restaurant.id);
  if (!hasFeature(entitlements, FEATURES.RESERVATIONS)) notFound();

  return (
    <div className="container-page max-w-xl py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Réserver une table
      </h1>
      <p className="mt-2 text-ink-muted">
        Envoyez votre demande à {restaurant.name} ; vous recevrez un code de
        confirmation dès qu&apos;elle sera validée.
      </p>

      <div className="mt-8">
        <ReservationForm restaurantId={restaurant.id} restaurantName={restaurant.name} />
      </div>
    </div>
  );
}
