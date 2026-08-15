import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { ReservationStatusTracker } from '@/components/site/reservation-status-tracker';

type Props = { params: Promise<{ host: string; reservationId: string }> };

export const metadata: Metadata = {
  title: 'Suivi de réservation',
  robots: { index: false, follow: false },
};

/**
 * Suivi public d'une réservation — accessible sans compte, comme le suivi de
 * commande. Voir `/api/public/reservations/[reservationId]` pour le modèle
 * de sécurité (identifiant non énumérable).
 */
export default async function ReservationTrackingPage({ params }: Props) {
  const { host, reservationId } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId: restaurant.id },
    select: {
      id: true,
      status: true,
      partySize: true,
      reservedFor: true,
      confirmationCode: true,
      updatedAt: true,
    },
  });

  if (!reservation) notFound();

  return (
    <div className="container-page max-w-lg py-10 sm:py-16">
      <ReservationStatusTracker
        reservationId={reservation.id}
        restaurantName={restaurant.name}
        initial={{
          status: reservation.status,
          partySize: reservation.partySize,
          reservedFor: reservation.reservedFor.toISOString(),
          confirmationCode: reservation.confirmationCode,
          updatedAt: reservation.updatedAt.toISOString(),
        }}
      />

      <div className="mt-8 text-center">
        <Link
          href={`/r/${host}/menu`}
          className="inline-flex h-11 items-center rounded-xl border border-surface-border px-6 font-medium hover:bg-surface-sunken"
        >
          Retour au menu
        </Link>
      </div>
    </div>
  );
}
