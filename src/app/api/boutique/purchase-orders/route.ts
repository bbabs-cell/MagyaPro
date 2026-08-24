import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { createPurchaseOrder } from '@/lib/boutique/purchases-service';
import { storePurchaseOrderSchema } from '@/lib/validation';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('purchases:view');

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { name: true } },
      items: { select: { id: true, quantityOrdered: true, quantityReceived: true, unitCost: true } },
    },
  });

  return ok({ purchaseOrders });
});

export const POST = route(async (request) => {
  const context = await requireStore('purchases:manage');
  await hit(`boutique-purchases:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storePurchaseOrderSchema, await readJson(request));

  const purchaseOrder = await createPurchaseOrder({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    input,
  });

  return ok({ purchaseOrder }, 201);
});
