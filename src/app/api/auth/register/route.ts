import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { registerAccount } from '@/lib/auth/service';
import { createSession, clientIp } from '@/lib/auth/session';
import { setActiveRestaurant } from '@/lib/tenant';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  hit(`register:${ip}`, RATE_LIMITS.register);

  const { turnstileToken, ...input } = parseOrThrow(registerSchema, await readJson(request));
  await verifyTurnstile(turnstileToken, ip);
  const { user, restaurant } = await registerAccount({ ...input, ip });

  // L'utilisateur est connecté immédiatement : lui demander de se reconnecter
  // juste après s'être inscrit n'apporte rien et fait perdre des comptes.
  await createSession(user.id);
  await setActiveRestaurant(restaurant.id);

  return ok(
    {
      user: { id: user.id, email: user.email, name: user.name },
      restaurant: { id: restaurant.id, slug: restaurant.slug },
      redirectTo: '/bienvenue',
    },
    201,
  );
});
