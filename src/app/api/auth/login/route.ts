import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { authenticate, issueVerificationToken } from '@/lib/auth/service';
import { clientIp, createSession, pruneExpiredSessions } from '@/lib/auth/session';
import { resolveLoginRedirect } from '@/lib/auth/redirect';
import { RATE_LIMITS, hit, reset } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

const TWO_FACTOR_PENDING_TTL_MINUTES = 5;

export const POST = route(async (request) => {
  const headerList = await headers();
  const ip = clientIp(headerList) ?? 'inconnu';
  const { turnstileToken, ...input } = parseOrThrow(loginSchema, await readJson(request));

  // Deux compteurs : par IP contre le balayage de comptes, par email contre le
  // bourrage ciblé d'un compte depuis plusieurs adresses.
  await hit(`login:ip:${ip}`, RATE_LIMITS.login);
  await hit(`login:email:${input.email}`, RATE_LIMITS.login);
  await verifyTurnstile(turnstileToken, ip);

  const user = await authenticate({ ...input, ip });

  await reset(`login:ip:${ip}`);
  await reset(`login:email:${input.email}`);

  // La destination dépend du produit d'où vient la connexion (l'hôte de la
  // requête) : se fier à l'hôte plutôt qu'à la seule présence d'une adhésion
  // Restaurant ou Boutique — un compte peut un jour posséder les deux, et
  // c'est la page de connexion utilisée qui indique l'intention.
  const host = (headerList.get('host') ?? '').split(':')[0]!.toLowerCase();

  // Mot de passe validé, mais pas de session tant que le second facteur
  // n'est pas passé : un jeton de courte durée porte la suite jusqu'à
  // /api/auth/2fa/verify-login.
  if (user.totpEnabled) {
    const pendingToken = await issueVerificationToken(
      user.id,
      'TWO_FACTOR_LOGIN',
      TWO_FACTOR_PENDING_TTL_MINUTES,
      'minutes',
    );
    return ok({ requiresTotp: true, pendingToken });
  }

  await createSession(user.id);
  // Attendu explicitement : une promesse « fire-and-forget » non suivie par
  // `waitUntil()` peut être coupée en cours de route par un runtime edge
  // (Cloudflare Workers) avant sa fin — et sur ce point précis, aussi
  // signalée comme une requête bloquée plutôt que silencieusement ignorée.
  await pruneExpiredSessions();

  const redirectTo = await resolveLoginRedirect(user, host);

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    redirectTo,
  });
});
