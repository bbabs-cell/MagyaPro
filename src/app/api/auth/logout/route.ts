import { ok, route } from '@/lib/api';
import { currentClientIp, destroySession, getCurrentUser } from '@/lib/auth/session';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

export const POST = route(async () => {
  const user = await getCurrentUser();

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.USER_LOGOUT,
      actorUserId: user.id,
      actorEmail: user.email,
      ip: await currentClientIp(),
    });
  }

  await destroySession();
  return ok({ redirectTo: '/' });
});
