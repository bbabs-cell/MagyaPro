import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { currentClientIp, requireSuperAdmin } from '@/lib/auth/session';
import { setStoreTestAccount } from '@/lib/admin/test-accounts';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ isTest: z.boolean() });

/** Marque une boutique comme compte de test, ou le rend aux chiffres — voir `test-accounts.ts`. */
export const PUT = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const input = parseOrThrow(schema, await readJson(request));
  const result = await setStoreTestAccount({
    storeId: id,
    isTest: input.isTest,
    actor: { id: admin.id, email: admin.email, ip: await currentClientIp() },
  });
  return ok(result);
});
