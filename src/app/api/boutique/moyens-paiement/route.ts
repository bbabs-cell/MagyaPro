import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { getEnabledPaymentMethods } from '@/lib/boutique/payment-methods';
import { ConflictError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('store:view');

  // Sème les valeurs par défaut si rien n'est encore configuré (voir
  // `getEnabledPaymentMethods`), puis relit la liste complète (activés et
  // désactivés) pour l'écran de gestion.
  await getEnabledPaymentMethods(store.id);
  const methods = await prisma.storePaymentMethod.findMany({
    where: { storeId: store.id },
    orderBy: { position: 'asc' },
  });

  return ok({ methods });
});

const createSchema = z.object({
  method: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/, 'Lettres minuscules, chiffres et underscore uniquement.')
    .min(1)
    .max(40),
  label: z.string().trim().min(1).max(60),
});

export const POST = route(async (request) => {
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(createSchema, await readJson(request));

  const existing = await prisma.storePaymentMethod.findUnique({
    where: { storeId_method: { storeId: context.store.id, method: input.method } },
  });
  if (existing) throw new ConflictError('Ce moyen de paiement existe déjà.');

  const count = await prisma.storePaymentMethod.count({ where: { storeId: context.store.id } });

  const created = await prisma.storePaymentMethod.create({
    data: { storeId: context.store.id, method: input.method, label: input.label, position: count },
  });

  return ok({ method: created }, 201);
});
