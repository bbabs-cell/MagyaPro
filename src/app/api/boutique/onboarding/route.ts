import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { getStoreEntitlements } from '@/lib/boutique/entitlements';
import { seedStoreUnits } from '@/lib/boutique/units-engine';

const businessTypes = [
  'CLOTHING',
  'SHOES',
  'ELECTRONICS',
  'COSMETICS',
  'GROCERY',
  'MERCERIE',
  'HARDWARE',
  'CONSTRUCTION',
  'HOUSEHOLD',
  'PHARMACY',
  'GENERAL',
  'OTHER',
] as const;

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

  // Complète le jeu d'unités avec celles du secteur retenu (le mètre et le
  // rouleau pour une mercerie, la bouteille et le carton pour une épicerie).
  // Purement additif : les unités déjà présentes, y compris renommées ou
  // désactivées par le commerçant, ne sont jamais touchées.
  await seedStoreUnits(context.store.id, input.businessType);

  // La configuration terminée, la boutique n'est pas forcément utilisable :
  // une boutique supplémentaire naît sans abonnement, volontairement. L'écran
  // suivant dépend donc de cet état, et c'est le serveur qui tranche.
  const entitlements = await getStoreEntitlements(context.store.id);

  return ok({ store, subscriptionActive: entitlements.isActive });
});
