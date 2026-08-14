import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { authenticate } from '@/lib/auth/service';
import { clientIp, createSession, pruneExpiredSessions } from '@/lib/auth/session';
import { RATE_LIMITS, hit, reset } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(loginSchema, await readJson(request));

  // Deux compteurs : par IP contre le balayage de comptes, par email contre le
  // bourrage ciblé d'un compte depuis plusieurs adresses.
  hit(`login:ip:${ip}`, RATE_LIMITS.login);
  hit(`login:email:${input.email}`, RATE_LIMITS.login);

  const user = await authenticate({ ...input, ip });

  reset(`login:ip:${ip}`);
  reset(`login:email:${input.email}`);

  await createSession(user.id);
  // Attendu explicitement : une promesse « fire-and-forget » non suivie par
  // `waitUntil()` peut être coupée en cours de route par un runtime edge
  // (Cloudflare Workers) avant sa fin — et sur ce point précis, aussi
  // signalée comme une requête bloquée plutôt que silencieusement ignorée.
  await pruneExpiredSessions();

  // La destination dépend de l'état du compte : un Super Admin arrive dans son
  // espace, un restaurateur dont l'onboarding est inachevé le reprend là où il
  // s'était arrêté.
  let redirectTo = '/dashboard';
  if (user.platformRole === 'SUPER_ADMIN') {
    redirectTo = '/admin';
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
