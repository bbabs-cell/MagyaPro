import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { requireStoreWithinLimit } from '@/lib/boutique/entitlements';
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
  await hit(`boutique-products:${context.store.id}`, RATE_LIMITS.write);
  await requireStoreWithinLimit(context.store.id, 'maxProducts');

  const input = parseOrThrow(storeProductSchema, await readJson(request));

  // Le prix de vente ne peut pas être inférieur au coût d'achat sans
  // avertissement — une inversion des deux champs est l'erreur de saisie la
  // plus fréquente sur ce genre de formulaire.
  if (input.price < input.cost) {
    throw new ValidationError('Le prix de vente est inférieur au coût.', {
      price: 'Doit être au moins égal au coût.',
    });
  }
  if (input.packSize && !input.packPrice) {
    throw new ValidationError('Le prix du carton est requis quand une taille de carton est définie.', {
      packPrice: 'Requis.',
    });
  }
  if (input.packPrice != null && input.packCost != null && input.packPrice < input.packCost) {
    throw new ValidationError('Le prix du carton est inférieur à son coût.', {
      packPrice: 'Doit être au moins égal au coût du carton.',
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
        unit: input.unit,
        variants: {
          create: {
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            cost: input.cost,
            price: input.price,
            attributes: input.attributes,
            packSize: input.packSize ?? null,
            packCost: input.packCost ?? null,
            packPrice: input.packPrice ?? null,
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
          expiryDate: input.initialStockExpiryDate ?? null,
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
