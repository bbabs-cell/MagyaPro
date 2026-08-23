import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findStoreScopedOrThrow, requireStore } from '@/lib/boutique/store-tenant';
import { storePromotionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ConflictError } from '@/lib/errors';
import type { StorePromotion } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('promotions:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<StorePromotion>('storePromotion', context.store.id, id);
  const input = parseOrThrow(storePromotionSchema, await readJson(request));

  const conflict = await prisma.storePromotion.findFirst({
    where: { storeId: context.store.id, code: input.code, NOT: { id } },
    select: { id: true },
  });
  if (conflict) throw new ConflictError('Ce code promo existe déjà.');

  const promotion = await prisma.storePromotion.update({
    where: { id },
    data: {
      code: input.code,
      type: input.type,
      value: input.value,
      minCartAmount: input.minCartAmount,
      maxRedemptions: input.maxRedemptions ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PROMOTION_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_promotion',
    targetId: promotion.id,
    metadata: { code: promotion.code },
  });

  return ok({ promotion });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('promotions:manage');
  const { id } = await params;

  const promotion = await findStoreScopedOrThrow<StorePromotion>(
    'storePromotion',
    context.store.id,
    id,
  );
  await prisma.storePromotion.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PROMOTION_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_promotion',
    targetId: id,
    metadata: { code: promotion.code },
  });

  return ok({ removed: true });
});
