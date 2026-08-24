import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { disableTwoFactor } from '@/lib/auth/service';
import { UnauthorizedError } from '@/lib/errors';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const schema = z.object({ password: z.string().min(1) });

/** Désactive la 2FA — exige le mot de passe, voir `disableTwoFactor`. */
export const POST = route(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  // Une session volée ne doit pas pouvoir bourrer le mot de passe pour
  // désactiver la 2FA — même limite que la vérification du code à la
  // connexion.
  await hit(`2fa-disable:${user.id}`, RATE_LIMITS.twoFactor);

  const { password } = parseOrThrow(schema, await readJson(request));
  await disableTwoFactor(user.id, password);

  return ok({ success: true });
});
