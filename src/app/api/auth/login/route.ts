import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { authenticate } from '@/lib/auth/service';
import { clientIp, createSession, pruneExpiredSessions } from '@/lib/auth/session';
import { RATE_LIMITS, hit, reset } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { verifyTurnstile } from '@/lib/turnstile';
import { rootHostname } from '@/lib/env';

export const POST = route(async (request) => {
  const headerList = await headers();
  const ip = clientIp(headerList) ?? 'inconnu';
  const { turnstileToken, ...input } = parseOrThrow(loginSchema, await readJson(request));

  // Deux compteurs : par IP contre le balayage de comptes, par email contre le
  // bourrage ciblé d'un compte depuis plusieurs adresses.
  hit(`login:ip:${ip}`, RATE_LIMITS.login);
  hit(`login:email:${input.email}`, RATE_LIMITS.login);
  await verifyTurnstile(turnstileToken, ip);

  const user = await authenticate({ ...input, ip });

  reset(`login:ip:${ip}`);
  reset(`login:email:${input.email}`);

  await createSession(user.id);
  // Attendu explicitement : une promesse « fire-and-forget » non suivie par
  // `waitUntil()` peut être coupée en cours de route par un runtime edge
  // (Cloudflare Workers) avant sa fin — et sur ce point précis, aussi
  // signalée comme une requête bloquée plutôt que silencieusement ignorée.
  await pruneExpiredSessions();

  // La destination dépend du produit d'où vient la connexion (l'hôte de la
  // requête) et de l'état du compte sur ce produit — un Super Admin arrive
  // dans son espace, un compte dont l'onboarding est inachevé le reprend là
  // où il s'était arrêté. Se fier à l'hôte plutôt qu'à la seule présence
  // d'une adhésion Restaurant ou Boutique : un compte peut un jour posséder
  // les deux, et c'est la page de connexion utilisée qui indique l'intention.
  const host = (headerList.get('host') ?? '').split(':')[0]!.toLowerCase();
  const isBoutiqueHost = host === `boutique.${rootHostname()}`;

  let redirectTo = '/dashboard';
  if (user.platformRole === 'SUPER_ADMIN') {
    redirectTo = '/admin';
  } else if (isBoutiqueHost) {
    const membership = await prisma.storeUser.findFirst({
      where: { userId: user.id },
      select: { store: { select: { onboardingCompletedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    redirectTo =
      membership && !membership.store.onboardingCompletedAt
        ? '/boutique/bienvenue'
        : '/boutique/dashboard';
  } else {
    const membership = await prisma.restaurantUser.findFirst({
      where: { userId: user.id },
      select: { restaurant: { select: { onboardingCompletedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (membership && !membership.restaurant.onboardingCompletedAt) {
      redirectTo = '/bienvenue';
    }
  }

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    redirectTo,
  });
});
