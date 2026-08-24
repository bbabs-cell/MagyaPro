import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { registerStoreSchema } from '@/lib/validation';
import { registerStoreAccount } from '@/lib/boutique/auth';
import { createSession, clientIp } from '@/lib/auth/session';
import { setActiveStore } from '@/lib/boutique/store-tenant';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  await hit(`store-register:${ip}`, RATE_LIMITS.register);

  const { turnstileToken, ...input } = parseOrThrow(registerStoreSchema, await readJson(request));
  await verifyTurnstile(turnstileToken, ip);
  const { user, store } = await registerStoreAccount({ ...input, ip });

  // L'utilisateur est connecté immédiatement : lui demander de se reconnecter
  // juste après s'être inscrit n'apporte rien et fait perdre des comptes.
  await createSession(user.id);
  await setActiveStore(store.id);

  return ok(
    {
      user: { id: user.id, email: user.email, name: user.name },
      store: { id: store.id, slug: store.slug },
      redirectTo: '/boutique/bienvenue',
    },
    201,
  );
});
