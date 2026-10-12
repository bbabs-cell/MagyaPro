import { z } from 'zod';
import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import { isAllowedPushEndpoint } from '@/lib/push';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const endpointSchema = z.object({ endpoint: z.string().url().max(1000) });

/**
 * Enregistre l'abonnement push de l'appareil courant pour l'utilisateur
 * connecté. Un même appareil (même adresse de service) est rattaché au
 * dernier compte qui s'y est connecté : sur un téléphone partagé, l'ancien
 * compte cesse de recevoir les alertes du nouveau.
 */
export const POST = route(async (request) => {
  const user = await requireUser();
  await hit(`push:subscribe:${user.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(subscriptionSchema, await readJson(request));
  if (!isAllowedPushEndpoint(input.endpoint)) {
    throw new ValidationError("Ce navigateur utilise un service de notification non pris en charge.");
  }

  const userAgent = (await headers()).get('user-agent')?.slice(0, 255) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent,
    },
    update: {
      userId: user.id,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent,
    },
  });

  return ok({ subscribed: true }, 201);
});

/** Désabonne l'appareil courant — seulement s'il appartient à l'utilisateur connecté. */
export const DELETE = route(async (request) => {
  const user = await requireUser();
  const { endpoint } = parseOrThrow(endpointSchema, {
    endpoint: new URL(request.url).searchParams.get('endpoint'),
  });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return ok({ subscribed: false });
});
