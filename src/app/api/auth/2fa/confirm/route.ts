import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { confirmTwoFactorEnrollment } from '@/lib/auth/service';
import { UnauthorizedError } from '@/lib/errors';

const schema = z.object({ code: z.string().trim().min(1).max(10) });

/** Confirme l'enrôlement et active la 2FA — voir `confirmTwoFactorEnrollment`. */
export const POST = route(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const { code } = parseOrThrow(schema, await readJson(request));
  const backupCodes = await confirmTwoFactorEnrollment(user.id, code);

  return ok({ backupCodes });
});
