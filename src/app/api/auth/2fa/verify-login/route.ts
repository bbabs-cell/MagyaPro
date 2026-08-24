import { headers } from 'next/headers';
import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { verifyTwoFactorLogin } from '@/lib/auth/service';
import { clientIp, createSession, pruneExpiredSessions } from '@/lib/auth/session';
import { resolveLoginRedirect } from '@/lib/auth/redirect';
import { RATE_LIMITS, hit, reset } from '@/lib/rate-limit';

const schema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().trim().min(1).max(20),
});

/** Seconde étape de connexion — voir `verifyTwoFactorLogin`. */
export const POST = route(async (request) => {
  const headerList = await headers();
  const ip = clientIp(headerList) ?? 'inconnu';
  const { pendingToken, code } = parseOrThrow(schema, await readJson(request));

  // Un compteur par jeton en attente : six chiffres, l'essai en boucle doit
  // rester impossible même limité à une seule connexion en cours.
  await hit(`2fa:${pendingToken}`, RATE_LIMITS.twoFactor);

  const user = await verifyTwoFactorLogin({ pendingToken, code, ip });
  await reset(`2fa:${pendingToken}`);

  // Calculé avant la session, comme dans /api/auth/login : un compte sans
  // adhésion sur le produit visé par cet hôte est refusé ici plutôt que de
  // recevoir une session pour un tableau de bord inexistant.
  const host = (headerList.get('host') ?? '').split(':')[0]!.toLowerCase();
  const redirectTo = await resolveLoginRedirect(user, host);

  await createSession(user.id);
  await pruneExpiredSessions();

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    redirectTo,
  });
});
