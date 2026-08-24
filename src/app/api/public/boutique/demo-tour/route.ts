import { headers } from 'next/headers';
import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { clientIp } from '@/lib/auth/session';
import { startDemoTour, endDemoTour } from '@/lib/boutique/store-tenant';
import { NotFoundError } from '@/lib/errors';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const schema = z.object({ slug: z.string().trim().min(1).max(80) });

/**
 * Démarre une visite guidée d'une boutique de démonstration, sans compte ni
 * mot de passe — voir `getDemoTourContext`. Public par nature (accessible
 * depuis la vitrine `/boutique`), mais restreint aux seules boutiques
 * marquées `isDemo` : ce endpoint ne peut jamais servir à accéder au
 * tableau de bord d'une vraie boutique.
 */
export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  await hit(`demo-tour:${ip}`, RATE_LIMITS.checkout);

  const { slug } = parseOrThrow(schema, await readJson(request));

  const store = await prisma.store.findFirst({
    where: { slug, isDemo: true, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!store) throw new NotFoundError('Boutique de démonstration introuvable.');

  await startDemoTour(store.id);

  return ok({ redirectTo: '/boutique/dashboard' });
});

/** Met fin à la visite guidée en cours. */
export const DELETE = route(async () => {
  await endDemoTour();
  return ok({ success: true });
});
