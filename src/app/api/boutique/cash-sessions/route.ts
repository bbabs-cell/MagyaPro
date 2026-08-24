import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { openCashSession } from '@/lib/boutique/cash-service';
import { openCashSessionSchema } from '@/lib/validation';

export const POST = route(async (request) => {
  const context = await requireStore('cash:manage');
  const input = parseOrThrow(openCashSessionSchema, await readJson(request));

  const session = await openCashSession({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    openingBalance: input.openingBalance,
  });

  return ok({ session }, 201);
});
