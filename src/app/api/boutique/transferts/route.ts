import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { createTransfer } from '@/lib/boutique/transfers-service';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { quantitySchema } from '@/lib/validation';

const schema = z.object({
  destinationStoreId: z.string().min(1).max(64),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1).max(64),
        /** En unité de base. */
        quantity: quantitySchema(1_000_000).refine((value) => value > 0, 'La quantité doit être supérieure à zéro.'),
      }),
    )
    .min(1, 'Ajoutez au moins un produit.')
    .max(500),
  note: z.string().trim().max(300).optional(),
});

/** Envoi de stock vers une autre boutique — voir `transfers-service.ts`. */
export const POST = route(async (request) => {
  const context = await requireStore('inventory:transfer');
  await hit(`boutique-stock:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(schema, await readJson(request));
  const transfer = await createTransfer({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    destinationStoreId: input.destinationStoreId,
    items: input.items,
    note: input.note,
  });

  return ok({ transfer: { id: transfer.id } }, 201);
});
