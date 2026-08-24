import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation';
import { requestPasswordReset } from '@/lib/auth/service';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  await hit(`forgot:${ip}`, RATE_LIMITS.passwordReset);

  const { email } = parseOrThrow(forgotPasswordSchema, await readJson(request));
  await requestPasswordReset(email);

  // Réponse identique que l'adresse existe ou non : la différencier
  // transformerait ce formulaire en outil d'énumération de comptes.
  return ok({
    message:
      'Si un compte est associé à cette adresse, un email de réinitialisation vient d\'être envoyé.',
  });
});
