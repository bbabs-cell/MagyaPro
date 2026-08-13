import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { ReservationsManager } from '@/components/dashboard/reservations-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Réservations' };
export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const context = await requireTenant('reservations:manage');

  const [reservations, entitlements] = await Promise.all([
    prisma.reservation.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { reservedFor: 'asc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const enabled = hasFeature(entitlements, FEATURES.RESERVATIONS);

  return (
    <>
      <PageHeader
        title="Réservations"
        description="Confirmez ou déclinez les réservations prises depuis votre site, ou ajoutez-en une pour une réservation prise par téléphone."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Fonctionnalité non incluse dans votre plan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            La réservation de table est disponible à partir des plans
            supérieurs. Vos clients ne peuvent pas encore réserver depuis votre
            site.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <ReservationsManager
        canManage={enabled}
        reservations={reservations.map((reservation) => ({
          id: reservation.id,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          partySize: reservation.partySize,
          reservedFor: reservation.reservedFor.toISOString(),
          notes: reservation.notes,
          status: reservation.status,
          confirmationCode: reservation.confirmationCode,
        }))}
      />
    </>
  );
}
