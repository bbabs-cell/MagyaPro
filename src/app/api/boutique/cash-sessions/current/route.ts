import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';

export const GET = route(async () => {
  const { store } = await requireStore('cash:manage');

  const session = await prisma.cashSession.findFirst({
    where: { storeId: store.id, status: 'OPEN' },
    include: {
      cashRegister: { select: { name: true } },
      movements: true,
      sales: { select: { id: true, total: true, payments: { select: { method: true, amount: true } } } },
    },
  });

  return ok({ session });
});
