import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court.').max(150),
  body: z.string().trim().min(3, 'Message trop court.').max(1000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** Annonces publiées, les plus récentes en premier. */
export const GET = route(async () => {
  await requireSuperAdmin();

  const announcements = await prisma.platformAnnouncement.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });

  return ok({ announcements });
});

export const POST = route(async (request) => {
  const admin = await requireSuperAdmin();
  const input = parseOrThrow(announcementSchema, await readJson(request));

  const announcement = await prisma.platformAnnouncement.create({
    data: {
      title: input.title,
      body: input.body,
      severity: input.severity,
      createdByEmail: admin.email,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.ANNOUNCEMENT_CREATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'announcement',
    targetId: announcement.id,
    ip: await currentClientIp(),
    metadata: { title: announcement.title, severity: announcement.severity },
  });

  return ok({ announcement }, 201);
});
