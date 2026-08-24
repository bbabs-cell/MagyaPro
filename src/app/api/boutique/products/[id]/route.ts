import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { nameSchema, optionalText, quantitySchema, urlSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import type { StoreProduct } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: nameSchema,
  description: optionalText(1000),
  categoryId: z.string().min(1).nullable().optional(),
  brandId: z.string().min(1).nullable().optional(),
  imageUrl: urlSchema.nullable().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']),
  minStockAlert: quantitySchema(1_000_000),
  unit: z.enum(['UNIT', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'PACK']),
});

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-products:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<StoreProduct>('storeProduct', context.store.id, id);
  const input = parseOrThrow(updateSchema, await readJson(request));

  const product = await prisma.storeProduct.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      imageUrl: input.imageUrl ?? null,
      status: input.status,
      minStockAlert: input.minStockAlert,
      unit: input.unit,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product',
    targetId: product.id,
  });

  return ok({ product });
});

/**
 * Un produit déjà vendu ne peut pas être supprimé — la ligne de vente le
 * référence pour toujours (voir `SaleItem.productVariant`, `onDelete:
 * Restrict`). L'archivage (`status: ARCHIVED`) est la voie normale ; la
 * suppression réelle ne réussit que pour un produit jamais vendu.
 */
export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('products:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<StoreProduct>('storeProduct', context.store.id, id);
  await prisma.storeProduct.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCT_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product',
    targetId: id,
  });

  return ok({ success: true });
});
