import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeProductUpdateSchema } from '@/lib/validation';
import { resolveRequestedBaseUnit, validateVariantUnits } from '@/lib/boutique/units-engine';
import { assertVariantsMatchAxes } from '@/lib/boutique/variants';
import { recordStockMovement } from '@/lib/boutique/inventory';
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
  const baseUnitId = await resolveRequestedBaseUnit(context.store, input.baseUnitId);
  const unitRows = await validateVariantUnits(context.store.id, baseUnitId, input.units);
  assertVariantsMatchAxes(input.variantAxes, input.variants);

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
    select: { id: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  // Modèle mono-variante en pratique aujourd'hui (une seule créée à la
  // fiche produit, voir `POST /api/boutique/products`) : la modification
  // porte donc sur cette première variante, jamais sur un identifiant de
  // variante fourni par le client.
  const defaultVariant = await prisma.storeProductVariant.findFirst({
    where: { productId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, product: { select: { baseUnitId: true } } },
  });

  // Changer l'unité de base d'un produit qui a déjà bougé réinterpréterait
  // silencieusement tout son stock et son historique : 277 enregistrés comme
  // des bouteilles deviendraient 277 cartons. Refusé tant qu'un mouvement
  // existe — le commerçant doit créer une nouvelle fiche.
  const previousBaseUnitId = defaultVariant?.product.baseUnitId ?? null;
  if (previousBaseUnitId && previousBaseUnitId !== baseUnitId) {
    const movements = await prisma.inventoryMovement.count({
      where: { productVariant: { productId: id } },
    });
    if (movements > 0) {
      throw new ValidationError(
        "L'unité de stock ne peut plus être changée : ce produit a déjà des mouvements de stock. Créez une nouvelle fiche pour le vendre dans une autre unité.",
        { baseUnitId: 'Non modifiable après le premier mouvement.' },
      );
    }
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.storeProduct.update({
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
        maxStock: input.maxStock ?? null,
        supplierLeadDays: input.supplierLeadDays ?? null,
        unit: input.unit,
        baseUnitId,
        variantAxes: input.variantAxes,
      },
    });

    // Produit sans déclinaison : la variante unique porte les champs de la
    // fiche, comme avant les déclinaisons.
    const declinations =
      input.variants.length > 0
        ? input.variants
        : defaultVariant
          ? [
              {
                id: defaultVariant.id,
                attributes: input.attributes,
                sku: input.sku,
                barcode: input.barcode,
                cost: input.cost,
                price: input.price,
                isActive: true,
                initialStock: 0,
              },
            ]
          : [];

    const keptIds = new Set<string>();

    for (const declination of declinations) {
      const data = {
        sku: declination.sku ?? null,
        barcode: declination.barcode ?? null,
        cost: declination.cost,
        price: declination.price,
        attributes: declination.attributes,
        isActive: declination.isActive,
      };

      const variantId = declination.id
        ? (
            await tx.storeProductVariant.update({
              where: { id: declination.id, productId: id },
              data,
              select: { id: true },
            })
          ).id
        : (
            await tx.storeProductVariant.create({
              data: { ...data, productId: id },
              select: { id: true },
            })
          ).id;

      keptIds.add(variantId);

      // Les conditionnements sont remplacés en bloc plutôt que fusionnés :
      // le formulaire envoie toujours la liste complète, et une ligne retirée
      // à l'écran doit disparaître. Sans effet sur l'historique, qui a figé
      // ses propres facteurs (voir `SaleItem.unitFactor`).
      await tx.storeVariantUnit.deleteMany({ where: { productVariantId: variantId } });
      if (unitRows.length > 0) {
        await tx.storeVariantUnit.createMany({
          data: unitRows.map((row) => ({ ...row, productVariantId: variantId })),
        });
      }

      // Le stock initial ne vaut que pour une déclinaison qui vient d'être
      // ajoutée : sur une variante existante, il doublerait le stock à chaque
      // enregistrement de la fiche.
      if (!declination.id && declination.initialStock > 0) {
        await recordStockMovement(
          {
            storeId: context.store.id,
            productVariantId: variantId,
            warehouseId: defaultWarehouse.id,
            type: 'INITIAL',
            quantityChange: declination.initialStock,
            userId: context.user.id,
            reason: 'Stock initial de la déclinaison',
            referenceType: 'store_product',
            referenceId: id,
          },
          tx,
        );
      }
    }

    // Une déclinaison retirée de l'écran est désactivée, jamais supprimée :
    // les ventes déjà réalisées la référencent pour toujours, et son stock
    // résiduel doit rester visible à l'inventaire.
    await tx.storeProductVariant.updateMany({
      where: { productId: id, id: { notIn: [...keptIds] } },
      data: { isActive: false },
    });

    return updated;
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
