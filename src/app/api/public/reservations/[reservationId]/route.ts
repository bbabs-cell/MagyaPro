import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ reservationId: string }> };

/**
 * Statut d'une réservation, pour le suivi côté client.
 *
 * Même modèle de sécurité que le suivi de commande : route publique sans
 * authentification, protégée par l'identifiant lui-même (cuid non
 * énumérable). Le code à 6 chiffres communiqué au client reste un code à
 * présenter sur place, pas une clé d'accès — trop court pour résister à un
 * essai systématique s'il servait de clé d'URL.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { reservationId } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
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

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { status: true },
  });
  if (!reservation) throw new NotFoundError('Réservation introuvable.');

  if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED') {
    throw new ValidationError('Cette réservation ne peut plus être annulée.');
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
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
