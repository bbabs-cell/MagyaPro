import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storePurchaseOrderSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { NotFoundError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('purchases:view');

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { name: true } },
      items: { select: { id: true, quantityOrdered: true, quantityReceived: true, unitCost: true } },
    },
  });

  return ok({ purchaseOrders });
});

/** Numéro de commande lisible, propre à chaque boutique. */
async function nextPurchaseOrderReference(storeId: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { storeId } });
  return `PO-${String(count + 1).padStart(4, '0')}`;
}

export const POST = route(async (request) => {
  const context = await requireStore('purchases:manage');
  hit(`boutique-purchases:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storePurchaseOrderSchema, await readJson(request));

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, storeId: context.store.id },
  });
  if (!supplier) throw new NotFoundError('Fournisseur introuvable.');

  const variantIds = input.items.map((item) => item.productVariantId);
  const variantCount = await prisma.storeProductVariant.count({
    where: { id: { in: variantIds }, product: { storeId: context.store.id } },
  });
  if (variantCount !== new Set(variantIds).size) {
    throw new NotFoundError('Un ou plusieurs produits sont introuvables.');
  }

  const reference = await nextPurchaseOrderReference(context.store.id);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      storeId: context.store.id,
      supplierId: input.supplierId,
      reference,
      status: 'ORDERED',
      orderedAt: new Date(),
      note: input.note ?? null,
      items: {
        create: input.items.map((item) => ({
          productVariantId: item.productVariantId,
          quantityOrdered: item.quantity,
          unitCost: item.unitCost,
        })),
      },
    },
    include: { items: true, supplier: { select: { name: true } } },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference },
  });

  return ok({ purchaseOrder }, 201);
});
