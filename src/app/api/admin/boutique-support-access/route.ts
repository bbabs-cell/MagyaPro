import { cookies } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp, SUPPORT_STORE_COOKIE } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { storeSupportAccessSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { env } from '@/lib/env';

/**
 * Ouverture d'un accès support sur une boutique — miroir de
 * `/api/admin/support-access` (Restaurant) : motivé, tracé, limité dans le
 * temps, révocable, visible par un bandeau permanent côté client.
 */
export const POST = route(async (request) => {
  const admin = await requireSuperAdmin();
  const input = parseOrThrow(storeSupportAccessSchema, await readJson(request));

  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, name: true },
  });
  if (!store) throw new NotFoundError('Boutique introuvable.');

  const ip = await currentClientIp();

  // Une session de support déjà ouverte par le même administrateur est close :
  // on ne laisse pas s'accumuler des accès ouverts sans fin.
  await prisma.storeSupportAccess.updateMany({
    where: { adminUserId: admin.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  const access = await prisma.storeSupportAccess.create({
    data: {
      adminUserId: admin.id,
      storeId: store.id,
      reason: input.reason,
      ip,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_STORE_COOKIE, access.id, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUPPORT_ACCESS_STARTED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    storeId: store.id,
    targetType: 'store_support_access',
    targetId: access.id,
    ip,
    metadata: { reason: input.reason, storeName: store.name },
  });

  return ok({ accessId: access.id, redirectTo: '/boutique/dashboard' }, 201);
});
