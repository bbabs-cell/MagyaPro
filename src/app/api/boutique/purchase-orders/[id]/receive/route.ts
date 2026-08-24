import { route, ok, parseOrThrow, readJson } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { receivePurchaseOrder } from '@/lib/boutique/purchases-service';
import { storePurchaseOrderReceiveSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  const { id } = await params;
  const input = parseOrThrow(storePurchaseOrderReceiveSchema, await readJson(request));

  const result = await receivePurchaseOrder({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    purchaseOrderId: id,
    input,
  });

  return ok(result);
});
