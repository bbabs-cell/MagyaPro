import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { applyStockCount } from '@/lib/boutique/stock-count-service';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { quantitySchema } from '@/lib/validation';

/**
 * Validation d'un inventaire guidé (voir `stock-count.ts`).
 *
 * Le stock « attendu » vient du navigateur : c'est ce que l'écran affichait
 * quand la ligne a été comptée, la seule base qui rende l'écart juste si des
 * ventes ont eu lieu entre-temps. Il ne donne aucun pouvoir supplémentaire :
 * la même permission permet déjà de retirer ou d'ajouter du stock.
 */
const schema = z.object({
  lines: z
    .array(
      z.object({
        productVariantId: z.string().min(1).max(64),
        counted: quantitySchema(10_000_000),
        expected: z.number().finite().min(-10_000_000).max(10_000_000),
      }),
    )
    .min(1, 'Aucun produit compté.')
    .max(5000, 'Comptage trop long : validez-le en plusieurs fois.'),
  note: z.string().trim().max(300).optional(),
});

export const POST = route(async (request) => {
  const context = await requireStore('inventory:manage');
  await hit(`boutique-stock:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(schema, await readJson(request));

  const result = await applyStockCount({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    lines: input.lines,
    note: input.note,
  });

  return ok(result, 201);
});
