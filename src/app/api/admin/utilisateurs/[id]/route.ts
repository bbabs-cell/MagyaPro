import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

/**
 * Suspend ou réactive un compte utilisateur.
 *
 * Une suspension prend effet immédiatement : `getCurrentUser` refuse les
 * comptes non actifs, sans attendre l'expiration de leurs sessions. Les
 * sessions ouvertes sont tout de même supprimées, pour libérer les lignes.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true, platformRole: true },
  });
  if (!user) throw new NotFoundError('Utilisateur introuvable.');

  // Se suspendre soi-même verrouillerait l'administration hors de la
  // plateforme sans recours par l'interface.
  if (user.id === admin.id) {
    throw new ConflictError('Vous ne pouvez pas suspendre votre propre compte.');
  }

  const { status } = parseOrThrow(schema, await readJson(request));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status },
  });

  if (status === 'SUSPENDED') {
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }

  await recordAudit({
    action:
      status === 'SUSPENDED'
        ? AUDIT_ACTIONS.USER_SUSPENDED
        : AUDIT_ACTIONS.USER_REACTIVATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'user',
    targetId: user.id,
    ip: await currentClientIp(),
    metadata: { email: user.email, from: user.status, to: status },
  });

  return ok({ user: { id: updated.id, status: updated.status } });
});
