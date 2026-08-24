import { headers } from 'next/headers';
import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { verifyEmail } from '@/lib/auth/service';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const schema = z.object({ token: z.string().min(10).max(200) });

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  // Le jeton (32 octets aléatoires) rend le brute-force déjà infaisable en
  // pratique — cette limite est une défense en profondeur supplémentaire,
  // par cohérence avec les autres points d'entrée d'authentification.
  await hit(`verify-email:${ip}`, RATE_LIMITS.passwordReset);

  const { token } = parseOrThrow(schema, await readJson(request));
  await verifyEmail(token);

  return ok({ message: 'Votre adresse email est confirmée.' });
});
