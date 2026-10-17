import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { currentClientIp, requireSuperAdmin } from '@/lib/auth/session';
import { setRestaurantTestAccount } from '@/lib/admin/test-accounts';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ isTest: z.boolean() });

/** Marque un restaurant comme compte de test, ou le rend aux chiffres — voir `test-accounts.ts`. */
export const PUT = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const input = parseOrThrow(schema, await readJson(request));
  const result = await setRestaurantTestAccount({
    restaurantId: id,
    isTest: input.isTest,
    actor: { id: admin.id, email: admin.email, ip: await currentClientIp() },
  });
  return ok(result);
});
