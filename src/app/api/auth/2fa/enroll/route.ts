import { ok, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { beginTwoFactorEnrollment } from '@/lib/auth/service';
import { UnauthorizedError } from '@/lib/errors';

/** Démarre (ou redémarre) un enrôlement 2FA — voir `beginTwoFactorEnrollment`. */
export const POST = route(async () => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const { secret, qrDataUrl } = await beginTwoFactorEnrollment(user.id, user.email);

  return ok({ secret, qrDataUrl });
});
