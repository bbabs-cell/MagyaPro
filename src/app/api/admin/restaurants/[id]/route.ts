import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Change le statut d'un restaurant depuis l'administration.
 *
 * Suspendre met le site public hors ligne et bloque les écritures du client,
 * tout en lui laissant l'accès en lecture pour comprendre la situation.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const input = parseOrThrow(statusSchema, await readJson(request));

  if (input.status === 'SUSPENDED' && !input.reason) {
    throw new ValidationError(
      'Indiquez le motif de la suspension : il est consigné au journal.',
      { reason: 'Motif requis.' },
    );
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      status: input.status,
      publishedAt: input.status === 'ACTIVE' ? new Date() : null,
    },
  });

  await recordAudit({
    action:
      input.status === 'SUSPENDED'
        ? AUDIT_ACTIONS.RESTAURANT_SUSPENDED
        : AUDIT_ACTIONS.RESTAURANT_REACTIVATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: await currentClientIp(),
    metadata: { from: restaurant.status, to: input.status, reason: input.reason },
  });

  return ok({ restaurant: { id: updated.id, status: updated.status } });
});

const deleteSchema = z.object({
  /** Le nom exact du restaurant, retapé par l'administrateur. */
  confirmation: z.string().trim().min(1),
});

/**
 * Suppression définitive d'un restaurant.
 *
 * Opération irréversible : elle emporte en cascade le menu, les commandes, les
 * clients et les paiements. D'où la double barrière — retaper le nom exact, et
 * refuser tant que le restaurant n'a pas été suspendu au préalable, ce qui
 * force un temps de réflexion et une trace.
 */
export const DELETE = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { orders: true } },
    },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const { confirmation } = parseOrThrow(deleteSchema, await readJson(request));

  if (confirmation !== restaurant.name) {
    throw new ValidationError(
      'Le nom saisi ne correspond pas à celui du restaurant.',
      { confirmation: 'Saisissez le nom exact du restaurant.' },
    );
  }

  if (restaurant.status !== 'SUSPENDED') {
    throw new ConflictError(
      'Suspendez le restaurant avant de le supprimer. Cela laisse une trace et évite les suppressions accidentelles.',
    );
  }

  // L'entrée de journal est écrite *avant* la suppression : la relation
  // `restaurantId` passe à null en cascade, mais le nom et le volume de
  // données perdues restent consignés dans les métadonnées.
  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_DELETED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: await currentClientIp(),
    metadata: {
      name: restaurant.name,
      ordersDeleted: restaurant._count.orders,
    },
  });

  await prisma.restaurant.delete({ where: { id: restaurant.id } });

  return ok({ deleted: true });
});
