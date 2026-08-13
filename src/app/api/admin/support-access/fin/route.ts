import { cookies } from 'next/headers';

import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp, SUPPORT_COOKIE } from '@/lib/auth/session';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/** Clôture l'accès support en cours et consigne sa durée. */
export const POST = route(async () => {
  const admin = await requireSuperAdmin();
  const cookieStore = await cookies();
  const accessId = cookieStore.get(SUPPORT_COOKIE)?.value;

  if (accessId) {
    const access = await prisma.supportAccess.findFirst({
      where: { id: accessId, adminUserId: admin.id, endedAt: null },
    });

    if (access) {
      const endedAt = new Date();
      await prisma.supportAccess.update({
        where: { id: access.id },
        data: { endedAt },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.SUPPORT_ACCESS_ENDED,
        actorUserId: admin.id,
        actorEmail: admin.email,
        restaurantId: access.restaurantId,
        targetType: 'support_access',
        targetId: access.id,
        ip: await currentClientIp(),
        metadata: {
          durationSeconds: Math.round(
            (endedAt.getTime() - access.startedAt.getTime()) / 1000,
          ),
        },
      });
    }
  }

  cookieStore.delete(SUPPORT_COOKIE);
  return ok({ redirectTo: '/admin' });
});
