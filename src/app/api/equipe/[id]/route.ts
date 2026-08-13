import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { PERMISSIONS } from '@/lib/rbac';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  role: z.enum(['ADMIN', 'EMPLOYEE']),
  extraPermissions: z
    .array(z.enum(PERMISSIONS as unknown as [string, ...string[]]))
    .max(PERMISSIONS.length)
    .default([]),
});

/**
 * Le propriétaire est intouchable par cette route : ni rétrogradable, ni
 * retirable. Un restaurant sans propriétaire n'aurait plus personne pour gérer
 * son abonnement ou son équipe.
 */
async function loadMembership(restaurantId: string, id: string) {
  const membership = await prisma.restaurantUser.findFirst({
    where: { id, restaurantId },
    include: { user: { select: { email: true } } },
  });
  if (!membership) throw new NotFoundError('Membre introuvable.');
  if (membership.role === 'OWNER') {
    throw new ConflictError(
      "Le propriétaire du restaurant ne peut pas être modifié ni retiré. Transférez d'abord la propriété.",
    );
  }
  return membership;
}

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('team:manage');
  const { id } = await params;

  const membership = await loadMembership(context.restaurant.id, id);
  const input = parseOrThrow(updateSchema, await readJson(request));

  const updated = await prisma.restaurantUser.update({
    where: { id: membership.id },
    data: { role: input.role, extraPermissions: input.extraPermissions },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.TEAM_MEMBER_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'restaurant_user',
    targetId: membership.id,
    metadata: { role: input.role },
  });

  return ok({ member: updated });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('team:manage');
  const { id } = await params;

  const membership = await loadMembership(context.restaurant.id, id);

  // Retirer un membre supprime son accès à ce restaurant, pas son compte
  // Magya : il peut appartenir à d'autres équipes.
  await prisma.restaurantUser.delete({ where: { id: membership.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.TEAM_MEMBER_REMOVED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'restaurant_user',
    targetId: membership.id,
    metadata: { email: membership.user.email },
  });

  return ok({ removed: true });
});
