import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { cancelPurchaseOrder } from '@/lib/boutique/purchases-service';

type Params = { params: Promise<{ id: string }> };

/** Annule une commande d'achat — seulement possible avant toute réception. */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  const { id } = await params;

  const purchaseOrder = await cancelPurchaseOrder({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    purchaseOrderId: id,
  });

  return ok({ purchaseOrder });
});
