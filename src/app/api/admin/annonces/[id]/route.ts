import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

/** Met fin à une annonce immédiatement, sans la supprimer (garde une trace). */
const endSchema = z.object({ end: z.literal(true) });

export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Annonce introuvable.');

  parseOrThrow(endSchema, await readJson(request));

  const announcement = await prisma.platformAnnouncement.update({
    where: { id },
    data: { expiresAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'announcement',
    targetId: id,
    ip: await currentClientIp(),
    metadata: { title: existing.title, action: 'ended_early' },
  });

  return ok({ announcement });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Annonce introuvable.');

  await prisma.platformAnnouncement.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.ANNOUNCEMENT_DELETED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'announcement',
    targetId: id,
    ip: await currentClientIp(),
    metadata: { title: existing.title },
  });

  return ok({ deleted: true });
});
