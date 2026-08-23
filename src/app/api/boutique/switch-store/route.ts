import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { setActiveStore } from '@/lib/boutique/store-tenant';

const switchStoreSchema = z.object({ storeId: z.string().min(1) });

/** Bascule la boutique active du compte connecté — voir `setActiveStore`. */
export const POST = route(async (request) => {
  const { storeId } = parseOrThrow(switchStoreSchema, await readJson(request));
  await setActiveStore(storeId);
  return ok({});
});
