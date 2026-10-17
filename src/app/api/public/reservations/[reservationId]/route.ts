import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { reservationAccessWhere } from '@/lib/reservations';

type Params = { params: Promise<{ reservationId: string }> };

/**
 * Statut d'une réservation, pour le suivi côté client.
 *
 * Route publique sans authentification, protégée par la clé du lien de suivi
 * — 32 octets aléatoires, voir `reservationAccessWhere`. Le segment d'URL
 * garde son nom historique (`reservationId`) mais porte cette clé ; seules les
 * réservations antérieures aux clés restent joignables par leur identifiant.
 * Le code à 6 chiffres communiqué au client reste un code à
 * présenter sur place, pas une clé d'accès — trop court pour résister à un
 * essai systématique s'il servait de clé d'URL.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { reservationId } = await params;

  const reservation = await prisma.reservation.findFirst({
    where: reservationAccessWhere(reservationId),
    select: {
      status: true,
      partySize: true,
      reservedFor: true,
      confirmationCode: true,
      updatedAt: true,
    },
  });

  if (!reservation) throw new NotFoundError('Réservation introuvable.');

  return ok(reservation);
});

/** Annulation par le client lui-même, à tout moment avant l'échéance. */
export const DELETE = route(async (_request, { params }: Params) => {
  const { reservationId } = await params;

  const reservation = await prisma.reservation.findFirst({
    where: reservationAccessWhere(reservationId),
    select: { id: true, status: true },
  });
  if (!reservation) throw new NotFoundError('Réservation introuvable.');

  if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED') {
    throw new ValidationError('Cette réservation ne peut plus être annulée.');
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: 'CANCELLED' },
    select: {
      status: true,
      partySize: true,
      reservedFor: true,
      confirmationCode: true,
      updatedAt: true,
    },
  });

  return ok(updated);
});
