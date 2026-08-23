import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';

/** Commandes en ligne d'une boutique — celles passées depuis le site public. */
export const GET = route(async () => {
  const { store } = await requireStore('orders:view');

  const orders = await prisma.storeOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  });

  return ok({ orders });
});
