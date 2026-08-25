import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeProductUpdateSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { ValidationError } from '@/lib/errors';
import type { StoreProduct } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-products:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<StoreProduct>('storeProduct', context.store.id, id);
  const input = parseOrThrow(storeProductUpdateSchema, await readJson(request));

  if (input.price < input.cost) {
    throw new ValidationError('Le prix de vente est inférieur au coût.', {
      price: 'Doit être au moins égal au coût.',
    });
  }

  // Modèle mono-variante en pratique aujourd'hui (une seule créée à la
  // fiche produit, voir `POST /api/boutique/products`) : la modification
  // porte donc sur cette première variante, jamais sur un identifiant de
  // variante fourni par le client.
  const defaultVariant = await prisma.storeProductVariant.findFirst({
    where: { productId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const [product] = await prisma.$transaction([
    prisma.storeProduct.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        supplierId: input.supplierId ?? null,
        imageUrl: input.imageUrl ?? null,
        status: input.status,
        minStockAlert: input.minStockAlert,
        unit: input.unit,
      },
    }),
    ...(defaultVariant
      ? [
          prisma.storeProductVariant.update({
            where: { id: defaultVariant.id },
            data: {
              sku: input.sku ?? null,
              barcode: input.barcode ?? null,
              cost: input.cost,
              price: input.price,
              attributes: input.attributes,
            },
          }),
        ]
      : []),
  ]);

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
