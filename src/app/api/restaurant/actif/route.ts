import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { setActiveRestaurant } from '@/lib/tenant';

const schema = z.object({ restaurantId: z.string().min(1) });

/**
 * Bascule le restaurant actif.
 *
 * `setActiveRestaurant` refuse tout identifiant pour lequel l'utilisateur n'a
 * pas d'adhésion : le cookie ne fait qu'exprimer une préférence parmi des
 * accès déjà légitimes.
 */
export const POST = route(async (request) => {
  const { restaurantId } = parseOrThrow(schema, await readJson(request));
  await setActiveRestaurant(restaurantId);
  return ok({ restaurantId });
});
