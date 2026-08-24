import { z } from 'zod';

import { route, ok, parseOrThrow, readJson } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { receivePurchaseOrder } from '@/lib/boutique/purchases-service';

type Params = { params: Promise<{ id: string }> };

const receiveSchema = z.object({
  /** Date de péremption commune au lot reçu, facultative (denrées, cosmétiques...). */
  expiryDate: z.coerce.date().optional(),
});

export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  const { id } = await params;
  const input = parseOrThrow(receiveSchema, await readJson(request).catch(() => ({})));

  await receivePurchaseOrder({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    purchaseOrderId: id,
    expiryDate: input.expiryDate,
  });

  return ok({ success: true });
});
