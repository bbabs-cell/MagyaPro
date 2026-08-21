import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeTeamMemberUpdateSchema } from '@/lib/validation';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

/**
 * Le propriétaire est intouchable par cette route, comme côté Restaurant :
 * une boutique sans propriétaire n'aurait plus personne pour gérer son
 * abonnement ou son équipe.
 */
async function loadMembership(storeId: string, id: string) {
  const membership = await prisma.storeUser.findFirst({
    where: { id, storeId },
    include: { user: { select: { email: true } } },
  });
  if (!membership) throw new NotFoundError('Membre introuvable.');
  if (membership.role === 'OWNER') {
    throw new ConflictError(
      "Le propriétaire de la boutique ne peut pas être modifié ni retiré.",
    );
  }
  return membership;
}

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('employees:manage');
  const { id } = await params;

  const membership = await loadMembership(context.store.id, id);
  const input = parseOrThrow(storeTeamMemberUpdateSchema, await readJson(request));

  const updated = await prisma.storeUser.update({
    where: { id: membership.id },
    data: { role: input.role, extraPermissions: input.extraPermissions },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_TEAM_MEMBER_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_user',
    targetId: membership.id,
    metadata: { role: input.role },
  });

  return ok({ member: updated });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('employees:manage');
  const { id } = await params;

  const membership = await loadMembership(context.store.id, id);

  await prisma.storeUser.delete({ where: { id: membership.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_TEAM_MEMBER_REMOVED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_user',
    targetId: membership.id,
    metadata: { email: membership.user.email },
  });

  return ok({ removed: true });
});
