import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { NotFoundError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

/** Détail d'une commande d'achat — lignes, réceptions déjà effectuées, paiements liés. */
export const GET = route(async (_request, { params }: Params) => {
  const { store } = await requireStore('purchases:view');
  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, storeId: store.id },
    include: {
      supplier: { select: { id: true, name: true, debtBalance: true } },
      items: {
        include: { productVariant: { select: { sku: true, product: { select: { name: true } } } } },
      },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');

  return ok({ purchaseOrder });
});
