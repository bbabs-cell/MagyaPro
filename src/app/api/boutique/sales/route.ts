import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { createSale } from '@/lib/boutique/sales-service';
import { storeSaleSchema } from '@/lib/validation';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('sales:view');

  const sales = await prisma.sale.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: { select: { productName: true, quantity: true } },
      payments: { select: { method: true, amount: true } },
    },
  });

  return ok({ sales });
});

export const POST = route(async (request) => {
  const context = await requireStore('pos:access');
  await hit(`boutique-sales:${context.store.id}`, RATE_LIMITS.checkout);

  const input = parseOrThrow(storeSaleSchema, await readJson(request));

  const sale = await createSale({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    input,
  });

  return ok({ sale }, 201);
});
