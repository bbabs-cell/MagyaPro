import { cookies } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp, SUPPORT_COOKIE } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { supportAccessSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { env } from '@/lib/env';

/**
 * Ouverture d'un accès support.
 *
 * Un Super Admin peut entrer dans l'espace d'un restaurant pour aider son
 * client. Cet accès est :
 *   - motivé (le motif est obligatoire et consigné) ;
 *   - tracé (enregistrement `SupportAccess` + entrée d'audit) ;
 *   - limité dans le temps (le cookie expire au bout de deux heures) ;
 *   - visible (un bandeau permanent s'affiche dans le dashboard) ;
 *   - restreint (ni suppression du restaurant, ni gestion de l'équipe —
 *     voir `SUPPORT_PERMISSIONS` dans `src/lib/tenant.ts`).
 *
 * Rien de tout cela n'est masquable : c'est la contrepartie d'un accès aux
 * données d'un client.
 */
export const POST = route(async (request) => {
  const admin = await requireSuperAdmin();
  const input = parseOrThrow(supportAccessSchema, await readJson(request));

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { id: true, name: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const ip = await currentClientIp();

  // Une session de support déjà ouverte par le même administrateur est close :
  // on ne laisse pas s'accumuler des accès ouverts sans fin.
  await prisma.supportAccess.updateMany({
    where: { adminUserId: admin.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  const access = await prisma.supportAccess.create({
    data: {
      adminUserId: admin.id,
      restaurantId: restaurant.id,
      reason: input.reason,
      ip,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_COOKIE, access.id, {
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
    restaurantId: restaurant.id,
    targetType: 'support_access',
    targetId: access.id,
    ip,
    metadata: { reason: input.reason, restaurantName: restaurant.name },
  });

  return ok({ accessId: access.id, redirectTo: '/dashboard' }, 201);
});
