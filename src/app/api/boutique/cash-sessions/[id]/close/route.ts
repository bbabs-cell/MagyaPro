import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { closeCashSession } from '@/lib/boutique/cash-service';
import { closeCashSessionSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('cash:manage');
  const { id } = await params;
  const input = parseOrThrow(closeCashSessionSchema, await readJson(request));

  const session = await closeCashSession({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    sessionId: id,
    countedBalance: input.countedBalance,
  });

  return ok({ session });
});
