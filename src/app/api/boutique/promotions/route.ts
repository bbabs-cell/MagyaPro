import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storePromotionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ConflictError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('promotions:manage');

  const promotions = await prisma.storePromotion.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
  });

  return ok({ promotions });
});

export const POST = route(async (request) => {
  const context = await requireStore('promotions:manage');

  const input = parseOrThrow(storePromotionSchema, await readJson(request));

  const existing = await prisma.storePromotion.findUnique({
    where: { storeId_code: { storeId: context.store.id, code: input.code } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('Ce code promo existe déjà.');

  const promotion = await prisma.storePromotion.create({
    data: {
      storeId: context.store.id,
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
    action: AUDIT_ACTIONS.STORE_PROMOTION_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_promotion',
    targetId: promotion.id,
    metadata: { code: promotion.code, type: promotion.type, value: promotion.value },
  });

  return ok({ promotion }, 201);
});
