import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { cancelTransfer } from '@/lib/boutique/transfers-service';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/** Annulation d'un envoi encore en route : le stock revient dans la boutique de départ. */
export const POST = route(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireStore('inventory:transfer');
  await hit(`boutique-stock:${context.store.id}`, RATE_LIMITS.write);

  const { id } = await params;
  await cancelTransfer({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    transferId: id,
  });
  return ok({ cancelled: true });
});
