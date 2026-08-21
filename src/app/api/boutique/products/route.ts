import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { storeProductSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { ValidationError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('products:view');

  const products = await prisma.storeProduct.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      variants: {
        include: { inventory: { select: { quantity: true, warehouseId: true } } },
      },
    },
  });

  return ok({ products });
});

export const POST = route(async (request) => {
  const context = await requireStore('products:manage');
  hit(`boutique-products:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeProductSchema, await readJson(request));

  // Le prix de vente ne peut pas être inférieur au coût d'achat sans
  // avertissement — une inversion des deux champs est l'erreur de saisie la
  // plus fréquente sur ce genre de formulaire.
  if (input.price < input.cost) {
    throw new ValidationError('Le prix de vente est inférieur au coût.', {
      price: 'Doit être au moins égal au coût.',
    });
  }

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.storeProduct.create({
      data: {
        storeId: context.store.id,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        supplierId: input.supplierId ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        status: input.status,
        minStockAlert: input.minStockAlert,
        variants: {
          create: {
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            cost: input.cost,
            price: input.price,
          },
        },
      },
      include: { variants: true },
    });

    const variant = created.variants[0]!;

    if (input.initialStock > 0) {
      await recordStockMovement(
        {
          storeId: context.store.id,
          productVariantId: variant.id,
          warehouseId: defaultWarehouse.id,
          type: 'INITIAL',
          quantityChange: input.initialStock,
          userId: context.user.id,
          reason: 'Stock initial à la création du produit',
          referenceType: 'store_product',
          referenceId: created.id,
        },
        tx,
      );
    }

    return created;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCT_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product',
    targetId: product.id,
    metadata: { name: product.name },
  });

  return ok({ product }, 201);
});
