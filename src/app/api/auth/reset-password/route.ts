import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/validation';
import { resetPassword } from '@/lib/auth/service';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  hit(`reset:${ip}`, RATE_LIMITS.passwordReset);

  const input = parseOrThrow(resetPasswordSchema, await readJson(request));
  await resetPassword({ ...input, ip });

  return ok({
    message: 'Votre mot de passe a été modifié. Vous pouvez vous connecter.',
    redirectTo: '/connexion',
  });
});
