import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { resolveRequestedBaseUnit, validateVariantUnits } from '@/lib/boutique/units-engine';
import { assertVariantsMatchAxes } from '@/lib/boutique/variants';
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
  const baseUnitId = await resolveRequestedBaseUnit(context.store, input.baseUnitId);
  const unitRows = await validateVariantUnits(context.store.id, baseUnitId, input.units);

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  // Produit sans déclinaison : une variante unique, construite depuis les
  // champs de la fiche — le cas de l'immense majorité des produits, et celui
  // de toutes les fiches créées avant les déclinaisons.
  const declinations =
    input.variants.length > 0
      ? input.variants
      : [
          {
            attributes: input.attributes,
            sku: input.sku,
            barcode: input.barcode,
            cost: input.cost,
            price: input.price,
            isActive: true,
            initialStock: input.initialStock,
          },
        ];

  assertVariantsMatchAxes(input.variantAxes, declinations);

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
        maxStock: input.maxStock ?? null,
        supplierLeadDays: input.supplierLeadDays ?? null,
        unit: input.unit,
        baseUnitId,
        variantAxes: input.variantAxes,
        variants: {
          create: declinations.map((declination) => ({
            sku: declination.sku ?? null,
            barcode: declination.barcode ?? null,
            cost: declination.cost,
            price: declination.price,
            attributes: declination.attributes,
            isActive: declination.isActive,
            // Les conditionnements sont les mêmes pour toutes les
            // déclinaisons : un carton de t-shirts en contient autant en S
            // qu'en XL. Le modèle autorise une divergence par variante, la
            // fiche ne la propose simplement pas encore.
            units: { create: unitRows },
          })),
        },
      },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });

    // Le stock initial est propre à chaque déclinaison : 5 en S, 12 en M.
    for (const [index, declination] of declinations.entries()) {
      if (declination.initialStock <= 0) continue;
      const variant = created.variants[index]!;
      await recordStockMovement(
        {
          storeId: context.store.id,
          productVariantId: variant.id,
          warehouseId: defaultWarehouse.id,
          type: 'INITIAL',
          quantityChange: declination.initialStock,
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
