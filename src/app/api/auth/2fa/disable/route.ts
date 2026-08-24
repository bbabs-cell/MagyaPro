import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { disableTwoFactor } from '@/lib/auth/service';
import { UnauthorizedError } from '@/lib/errors';

const schema = z.object({ password: z.string().min(1) });

/** Désactive la 2FA — exige le mot de passe, voir `disableTwoFactor`. */
export const POST = route(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const { password } = parseOrThrow(schema, await readJson(request));
  await disableTwoFactor(user.id, password);

  return ok({ success: true });
});
