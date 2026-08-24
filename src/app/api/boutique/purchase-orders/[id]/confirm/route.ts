import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { confirmPurchaseOrder } from '@/lib/boutique/purchases-service';

type Params = { params: Promise<{ id: string }> };

/** Confirme un brouillon de commande d'achat — passe de DRAFT à ORDERED. */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  const { id } = await params;

  const purchaseOrder = await confirmPurchaseOrder({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    purchaseOrderId: id,
  });

  return ok({ purchaseOrder });
});
