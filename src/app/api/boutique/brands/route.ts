import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeBrandSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('products:view');

  const brands = await prisma.brand.findMany({
    where: { storeId: store.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return ok({ brands });
});

export const POST = route(async (request) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-brands:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeBrandSchema, await readJson(request));

  const brand = await prisma.brand.create({
    data: {
      storeId: context.store.id,
      name: input.name,
      logoUrl: input.logoUrl ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_BRAND_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'brand',
    targetId: brand.id,
    metadata: { name: brand.name },
  });

  return ok({ brand }, 201);
});
