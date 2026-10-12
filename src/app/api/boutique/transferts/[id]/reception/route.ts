import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { receiveTransfer } from '@/lib/boutique/transfers-service';
import { ForbiddenError } from '@/lib/errors';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/** Réception d'un transfert arrivé dans la boutique ouverte. */
export const POST = route(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireStore();
  if (!context.permissions.has('inventory:transfer') && !context.permissions.has('inventory:manage')) {
    throw new ForbiddenError();
  }
  await hit(`boutique-stock:${context.store.id}`, RATE_LIMITS.write);

  const { id } = await params;
  const result = await receiveTransfer({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    transferId: id,
  });
  return ok(result);
});
