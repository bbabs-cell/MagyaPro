import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { resolveVariantUnits, toBaseQuantity } from '@/lib/boutique/units-engine';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { WITHDRAWAL_REASONS, quantitySchema } from '@/lib/validation';

/**
 * Retrait de stock avec motif — perte, casse, péremption…
 *
 * Distinct de l'archivage et de la suppression : le produit reste actif et
 * vendable, seule sa quantité baisse. C'est le mouvement le plus courant
 * après la vente, et le seul qui manquait d'un écran alors que le type
 * existait déjà en base.
 *
 * Le motif est obligatoire : un stock qui diminue sans explication rend
 * l'inventaire incompréhensible trois mois plus tard.
 */
const schema = z.object({
  productVariantId: z.string().min(1),
  /** Quantité exprimée dans `unitId` — convertie en unité de base côté serveur. */
  quantity: quantitySchema(1_000_000).refine((v) => v > 0, 'La quantité doit être supérieure à zéro.'),
  unitId: z.string().min(1).optional(),
  reason: z.enum(Object.keys(WITHDRAWAL_REASONS) as [string, ...string[]]),
  note: z.string().trim().max(300).optional(),
});

export const POST = route(async (request) => {
  const context = await requireStore('inventory:manage');
  await hit(`boutique-stock:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(schema, await readJson(request));

  // La variante doit appartenir à cette boutique : un identifiant venu du
  // client ne désigne jamais le stock d'une autre.
  const variant = await prisma.storeProductVariant.findFirst({
    where: { id: input.productVariantId, product: { storeId: context.store.id } },
    select: { id: true, product: { select: { id: true, name: true } } },
  });
  if (!variant) throw new NotFoundError('Produit introuvable.');

  const units = await resolveVariantUnits({
    storeId: context.store.id,
    productVariantId: variant.id,
  });
  const unit = input.unitId
    ? units.find((candidate) => candidate.unitId === input.unitId)
    : units.find((candidate) => candidate.isBase);
  if (!unit) throw new ValidationError('Unité inconnue pour ce produit.');

  const baseQuantity = toBaseQuantity(input.quantity, unit.factor);
  const reasonLabel = WITHDRAWAL_REASONS[input.reason as keyof typeof WITHDRAWAL_REASONS];

  // Le motif est figé dans le mouvement, avec l'unité saisie : relire
  // « 2 cartons » des mois plus tard est plus parlant que « 40 ».
  const reason = [
    reasonLabel,
    unit.isBase ? null : `${input.quantity} ${unit.label} × ${unit.factor}`,
    input.note,
  ]
    .filter(Boolean)
    .join(' — ');

  const movement = await recordStockMovement({
    storeId: context.store.id,
    productVariantId: variant.id,
    warehouseId: (
      await prisma.warehouse.findFirstOrThrow({
        where: { storeId: context.store.id, isDefault: true },
        select: { id: true },
      })
    ).id,
    type: 'ADJUSTMENT',
    quantityChange: -baseQuantity,
    userId: context.user.id,
    reason,
    referenceType: 'stock_withdrawal',
    referenceId: variant.product.id,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product',
    targetId: variant.product.id,
    metadata: { withdrawal: baseQuantity, reason: input.reason },
  });

  return ok({ movement }, 201);
});
