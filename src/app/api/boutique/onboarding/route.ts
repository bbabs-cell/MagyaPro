import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';

const businessTypes = ['CLOTHING', 'ELECTRONICS', 'COSMETICS', 'GROCERY', 'OTHER'] as const;

const schema = z.object({
  businessType: z.enum(businessTypes),
  phone: z.string().min(6).max(30),
  addressLine: z.string().min(3).max(200),
  city: z.string().min(2).max(100),
  currency: z.string().min(3).max(3),
});

/**
 * Onboarding MagyaPro Boutique — première version, à une seule étape :
 * l'essentiel pour démarrer (type de commerce, coordonnées, devise). Les
 * étapes suivantes du parcours prévu (logo, catégories, premier produit,
 * stock initial, caisse, moyens de paiement — voir la mission) arriveront
 * avec les fonctionnalités correspondantes, pas avant : les proposer déjà
 * ici simulerait un parcours qui n'aboutit encore nulle part.
 */
export const POST = route(async (request) => {
  const context = await requireStore('store:update');
  const input = parseOrThrow(schema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: {
      businessType: input.businessType,
      phone: input.phone,
      addressLine: input.addressLine,
      city: input.city,
      currency: input.currency.toUpperCase(),
      onboardingStep: 1,
      onboardingCompletedAt: context.store.onboardingCompletedAt ?? new Date(),
    },
    select: { onboardingCompletedAt: true },
  });

  return ok({ store });
});
