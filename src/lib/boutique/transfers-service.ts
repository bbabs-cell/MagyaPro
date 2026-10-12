import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { effectiveStorePermissions } from '@/lib/boutique/rbac';
import { toQty, roundQty } from '@/lib/boutique/quantity';
import { UNIT_LABELS, unitLabelFor } from '@/lib/boutique/units';
import { createNotification } from '@/lib/notifications';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

/**
 * Transferts de stock entre boutiques d'un même commerçant.
 *
 * ## Deux temps, comme la marchandise
 *
 * 1. **Envoi** (boutique de départ) : le stock sort aussitôt — il n'est plus
 *    en rayon, il ne doit plus être vendable. Le transfert est « en route ».
 * 2. **Réception** (boutique d'arrivée) : quelqu'un sur place confirme
 *    l'arrivée, et le stock entre. Tant que ce n'est pas fait, rien n'entre :
 *    un carton perdu en route ne gonfle pas le stock de la boutique d'arrivée.
 *
 * Un envoi encore en route peut être annulé depuis la boutique de départ :
 * le stock y revient.
 *
 * ## Les fiches produits ne sont pas partagées
 *
 * Chaque boutique a son propre catalogue. À la réception, chaque article est
 * rapproché d'une fiche de la boutique d'arrivée — par code-barres, puis par
 * référence, puis par nom — et, s'il n'y en a pas, la fiche est créée par
 * copie (prix, coût, code-barres, unités). Le rapprochement se fait à la
 * réception et non à l'envoi : c'est le catalogue d'arrivée à ce moment-là
 * qui compte, et aucune colonne n'a eu à être ajoutée.
 */

type Tx = Prisma.TransactionClient;

/** Droits de l'utilisateur dans une autre boutique que celle ouverte. */
async function permissionsIn(storeId: string, userId: string) {
  const membership = await prisma.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId } },
    select: { role: true, extraPermissions: true },
  });
  return membership ? effectiveStorePermissions(membership.role, membership.extraPermissions) : null;
}

/** Boutiques vers lesquelles l'utilisateur peut envoyer du stock depuis `storeId`. */
export async function listTransferDestinations(storeId: string, userId: string) {
  const memberships = await prisma.storeUser.findMany({
    where: { userId, storeId: { not: storeId }, store: { status: { not: 'SUSPENDED' } } },
    select: { role: true, extraPermissions: true, store: { select: { id: true, name: true, currency: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships
    .filter((m) => {
      const granted = effectiveStorePermissions(m.role, m.extraPermissions);
      return granted.has('inventory:transfer') || granted.has('inventory:manage');
    })
    .map((m) => m.store);
}

async function defaultWarehouseId(storeId: string, tx: Tx | typeof prisma = prisma) {
  const warehouse = await tx.warehouse.findFirst({
    where: { storeId, isDefault: true },
    select: { id: true },
  });
  if (!warehouse) throw new ValidationError("Cette boutique n'a pas d'entrepôt principal.");
  return warehouse.id;
}

export async function createTransfer(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  destinationStoreId: string;
  items: Array<{ productVariantId: string; quantity: number }>;
  note?: string | null;
}) {
  if (params.destinationStoreId === params.storeId) {
    throw new ValidationError('Choisissez une autre boutique que celle-ci.');
  }
  if (params.items.length === 0) throw new ValidationError('Ajoutez au moins un produit.');

  const ids = params.items.map((item) => item.productVariantId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError('Un même produit apparaît deux fois dans le transfert.');
  }

  // La boutique d'arrivée : l'utilisateur doit y avoir le droit de gérer le
  // stock. Un identifiant de boutique venu du navigateur ne suffit jamais.
  const destinationPermissions = await permissionsIn(params.destinationStoreId, params.userId);
  if (
    !destinationPermissions ||
    !(destinationPermissions.has('inventory:transfer') || destinationPermissions.has('inventory:manage'))
  ) {
    throw new ForbiddenError("Vous ne gérez pas le stock de la boutique d'arrivée.");
  }

  const [source, destination, variants] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: params.storeId },
      select: { name: true, allowNegativeStock: true },
    }),
    prisma.store.findUnique({
      where: { id: params.destinationStoreId },
      select: { id: true, name: true, status: true },
    }),
    prisma.storeProductVariant.findMany({
      where: { id: { in: ids }, product: { storeId: params.storeId } },
      select: { id: true, product: { select: { name: true } } },
    }),
  ]);
  if (!destination || destination.status === 'SUSPENDED') {
    throw new NotFoundError("Boutique d'arrivée introuvable.");
  }
  if (variants.length !== ids.length) throw new NotFoundError('Produit introuvable.');

  const [fromWarehouseId, toWarehouseId] = await Promise.all([
    defaultWarehouseId(params.storeId),
    defaultWarehouseId(params.destinationStoreId),
  ]);

  const transfer = await prisma.$transaction(
    async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          fromWarehouseId,
          toWarehouseId,
          status: 'IN_TRANSIT',
          note: params.note?.trim() || null,
          sentAt: new Date(),
          items: {
            create: params.items.map((item) => ({
              productVariantId: item.productVariantId,
              quantity: roundQty(item.quantity),
            })),
          },
        },
      });

      for (const item of params.items) {
        await recordStockMovement(
          {
            storeId: params.storeId,
            productVariantId: item.productVariantId,
            warehouseId: fromWarehouseId,
            type: 'TRANSFER_OUT',
            quantityChange: -roundQty(item.quantity),
            userId: params.userId,
            reason: `Transfert vers ${destination.name}`,
            referenceType: 'stock_transfer',
            referenceId: created.id,
            allowNegativeStock: source.allowNegativeStock,
          },
          tx,
        );
      }
      return created;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  await Promise.all([
    createNotification({
      storeId: params.destinationStoreId,
      type: 'SYSTEM_ALERT',
      title: `Transfert en route depuis ${source.name}`,
      body: `${params.items.length} produit${params.items.length > 1 ? 's' : ''} à réceptionner à leur arrivée.`,
      href: '/boutique/dashboard/transferts',
    }),
    recordAudit({
      action: AUDIT_ACTIONS.STORE_STOCK_TRANSFERRED,
      actorUserId: params.userId,
      actorEmail: params.userEmail,
      storeId: params.storeId,
      targetType: 'stock_transfer',
      targetId: transfer.id,
      metadata: { to: params.destinationStoreId, items: params.items.length },
    }),
  ]);

  return transfer;
}

/** Charge un transfert en route et vérifie que `storeId` est bien du côté demandé. */
async function loadInTransit(transferId: string, storeId: string, side: 'from' | 'to') {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: true,
      fromWarehouse: { select: { id: true, storeId: true, store: { select: { name: true } } } },
      toWarehouse: { select: { id: true, storeId: true, store: { select: { name: true } } } },
    },
  });
  const owner = side === 'from' ? transfer?.fromWarehouse.storeId : transfer?.toWarehouse.storeId;
  if (!transfer || owner !== storeId) throw new NotFoundError('Transfert introuvable.');
  if (transfer.status !== 'IN_TRANSIT') {
    throw new ConflictError(
      transfer.status === 'RECEIVED' ? 'Ce transfert a déjà été réceptionné.' : 'Ce transfert a été annulé.',
    );
  }
  return transfer;
}

/**
 * Passe un transfert de « en route » à `status`, une seule fois : la
 * condition sur le statut rend la double réception (deux téléphones, un
 * double toucher) impossible, sans verrou.
 */
async function closeTransfer(tx: Tx, transferId: string, status: 'RECEIVED' | 'CANCELLED') {
  const updated = await tx.stockTransfer.updateMany({
    where: { id: transferId, status: 'IN_TRANSIT' },
    data: { status, ...(status === 'RECEIVED' ? { receivedAt: new Date() } : {}) },
  });
  if (updated.count === 0) throw new ConflictError('Ce transfert vient déjà d’être traité.');
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

type SourceVariant = Awaited<ReturnType<typeof loadSourceVariants>>[number];

function loadSourceVariants(ids: string[], tx: Tx) {
  return tx.storeProductVariant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      attributes: true,
      cost: true,
      price: true,
      packSize: true,
      packCost: true,
      packPrice: true,
      units: { include: { unit: true } },
      product: {
        select: {
          name: true,
          description: true,
          imageUrl: true,
          unit: true,
          variantAxes: true,
          minStockAlert: true,
          baseUnit: true,
          category: { select: { name: true } },
        },
      },
    },
  });
}

/** Unité de même code dans la boutique d'arrivée, créée à l'identique si besoin. */
async function unitIn(
  tx: Tx,
  storeId: string,
  unit: { code: string; label: string; labelPlural: string | null; isDecimal: boolean; isCustom: boolean },
) {
  const existing = await tx.storeUnit.findUnique({
    where: { storeId_code: { storeId, code: unit.code } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.storeUnit.create({
    data: {
      storeId,
      code: unit.code,
      label: unit.label,
      labelPlural: unit.labelPlural,
      isDecimal: unit.isDecimal,
      isCustom: unit.isCustom,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * La fiche correspondante dans la boutique d'arrivée — ou une copie créée
 * pour l'occasion. Refuse un rapprochement dont l'unité de stock diffère :
 * 24 « bouteilles » ne peuvent pas entrer comme 24 « cartons ».
 */
async function destinationVariant(
  tx: Tx,
  storeId: string,
  source: SourceVariant,
): Promise<{ id: string; created: boolean }> {
  const candidates = await tx.storeProductVariant.findMany({
    where: {
      product: { storeId, status: { not: 'ARCHIVED' } },
      OR: [
        ...(source.barcode ? [{ barcode: source.barcode }] : []),
        ...(source.sku ? [{ sku: source.sku }] : []),
        { product: { name: { equals: source.product.name, mode: 'insensitive' as const } } },
      ],
    },
    select: {
      id: true,
      sku: true,
      barcode: true,
      attributes: true,
      isActive: true,
      product: { select: { name: true, baseUnit: { select: { code: true } } } },
    },
  });

  const sameAttributes = (attributes: Prisma.JsonValue) =>
    JSON.stringify(attributes ?? {}) === JSON.stringify(source.attributes ?? {});
  const match =
    (source.barcode && candidates.find((c) => c.barcode === source.barcode)) ||
    (source.sku && candidates.find((c) => c.sku === source.sku)) ||
    candidates.find(
      (c) => normalizeName(c.product.name) === normalizeName(source.product.name) && sameAttributes(c.attributes),
    );

  if (match) {
    const sourceCode = source.product.baseUnit?.code;
    const targetCode = match.product.baseUnit?.code;
    if (sourceCode && targetCode && sourceCode !== targetCode) {
      throw new ValidationError(
        `« ${match.product.name} » n'est pas compté dans la même unité dans les deux boutiques. Alignez les fiches avant de réceptionner.`,
      );
    }
    return { id: match.id, created: false };
  }

  // Aucune fiche : copie fidèle, catégorie retrouvée par son nom.
  const category = source.product.category
    ? await tx.storeCategory.findFirst({
        where: { storeId, name: source.product.category.name },
        select: { id: true },
      })
    : null;
  const baseUnitId = source.product.baseUnit ? await unitIn(tx, storeId, source.product.baseUnit) : null;

  const product = await tx.storeProduct.create({
    data: {
      storeId,
      name: source.product.name,
      description: source.product.description,
      imageUrl: source.product.imageUrl,
      unit: source.product.unit,
      baseUnitId,
      categoryId: category?.id ?? null,
      variantAxes: source.product.variantAxes ?? [],
      minStockAlert: source.product.minStockAlert,
      status: 'ACTIVE',
      variants: {
        create: {
          sku: source.sku,
          barcode: source.barcode,
          attributes: source.attributes ?? {},
          cost: source.cost,
          price: source.price,
          packSize: source.packSize,
          packCost: source.packCost,
          packPrice: source.packPrice,
        },
      },
    },
    select: { variants: { select: { id: true } } },
  });
  const variantId = product.variants[0]!.id;

  for (const row of source.units) {
    if (row.unitId === source.product.baseUnit?.id) continue;
    await tx.storeVariantUnit.create({
      data: {
        productVariantId: variantId,
        unitId: await unitIn(tx, storeId, row.unit),
        factor: row.factor,
        price: row.price,
        cost: row.cost,
        isSellable: row.isSellable,
        isPurchasable: row.isPurchasable,
        position: row.position,
      },
    });
  }

  return { id: variantId, created: true };
}

export async function receiveTransfer(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  transferId: string;
}) {
  const transfer = await loadInTransit(params.transferId, params.storeId, 'to');
  const sourceName = transfer.fromWarehouse.store.name;

  const result = await prisma.$transaction(
    async (tx) => {
      await closeTransfer(tx, transfer.id, 'RECEIVED');
      const sources = await loadSourceVariants(
        transfer.items.map((item) => item.productVariantId),
        tx,
      );
      const byId = new Map(sources.map((variant) => [variant.id, variant]));

      let created = 0;
      for (const item of transfer.items) {
        const source = byId.get(item.productVariantId);
        if (!source) throw new NotFoundError("Un produit de ce transfert n'existe plus dans la boutique de départ.");
        const target = await destinationVariant(tx, params.storeId, source);
        if (target.created) created += 1;
        await recordStockMovement(
          {
            storeId: params.storeId,
            productVariantId: target.id,
            warehouseId: transfer.toWarehouse.id,
            type: 'TRANSFER_IN',
            quantityChange: toQty(item.quantity),
            userId: params.userId,
            reason: `Transfert depuis ${sourceName}`,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
          },
          tx,
        );
      }
      return { received: transfer.items.length, createdProducts: created };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_STOCK_TRANSFER_RECEIVED,
    actorUserId: params.userId,
    actorEmail: params.userEmail,
    storeId: params.storeId,
    targetType: 'stock_transfer',
    targetId: transfer.id,
    metadata: result,
  });

  return result;
}

export async function cancelTransfer(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  transferId: string;
}) {
  const transfer = await loadInTransit(params.transferId, params.storeId, 'from');

  await prisma.$transaction(
    async (tx) => {
      await closeTransfer(tx, transfer.id, 'CANCELLED');
      for (const item of transfer.items) {
        await recordStockMovement(
          {
            storeId: params.storeId,
            productVariantId: item.productVariantId,
            warehouseId: transfer.fromWarehouse.id,
            type: 'TRANSFER_IN',
            quantityChange: toQty(item.quantity),
            userId: params.userId,
            reason: `Transfert vers ${transfer.toWarehouse.store.name} annulé`,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
          },
          tx,
        );
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_STOCK_TRANSFER_CANCELLED,
    actorUserId: params.userId,
    actorEmail: params.userEmail,
    storeId: params.storeId,
    targetType: 'stock_transfer',
    targetId: transfer.id,
  });
}

export type TransferRow = {
  id: string;
  direction: 'out' | 'in';
  otherStore: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  note: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  /** Quantité en unité de base, avec le nom de cette unité accordé. */
  items: Array<{ name: string; quantity: number; unit: string }>;
};

/** Transferts envoyés et reçus par une boutique, les plus récents d'abord. */
export async function listTransfers(storeId: string, limit = 50): Promise<TransferRow[]> {
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      OR: [{ fromWarehouse: { storeId } }, { toWarehouse: { storeId } }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      items: true,
      fromWarehouse: { select: { storeId: true, store: { select: { name: true } } } },
      toWarehouse: { select: { storeId: true, store: { select: { name: true } } } },
    },
  });

  // Les noms viennent de la boutique de départ, seule à connaître ces fiches.
  const variantIds = [...new Set(transfers.flatMap((t) => t.items.map((item) => item.productVariantId)))];
  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      attributes: true,
      product: { select: { name: true, unit: true, baseUnit: { select: { label: true, labelPlural: true } } } },
    },
  });
  const unitById = new Map(
    variants.map((variant) => [
      variant.id,
      variant.product.baseUnit ?? { label: UNIT_LABELS[variant.product.unit] ?? '', labelPlural: UNIT_LABELS[variant.product.unit] ?? '' },
    ]),
  );
  const nameById = new Map(
    variants.map((variant) => {
      const detail = Object.values((variant.attributes ?? {}) as Record<string, string>).filter(Boolean).join(' · ');
      return [variant.id, detail ? `${variant.product.name} (${detail})` : variant.product.name];
    }),
  );

  return transfers.map((transfer) => {
    const outgoing = transfer.fromWarehouse.storeId === storeId;
    return {
      id: transfer.id,
      direction: outgoing ? 'out' : 'in',
      otherStore: outgoing ? transfer.toWarehouse.store.name : transfer.fromWarehouse.store.name,
      status: transfer.status,
      note: transfer.note,
      sentAt: transfer.sentAt?.toISOString() ?? null,
      receivedAt: transfer.receivedAt?.toISOString() ?? null,
      createdAt: transfer.createdAt.toISOString(),
      items: transfer.items.map((item) => {
        const quantity = toQty(item.quantity);
        const unit = unitById.get(item.productVariantId);
        return {
          name: nameById.get(item.productVariantId) ?? 'Produit supprimé',
          quantity,
          unit: unit ? unitLabelFor({ label: unit.label, labelPlural: unit.labelPlural ?? unit.label }, quantity) : '',
        };
      }),
    };
  });
}

