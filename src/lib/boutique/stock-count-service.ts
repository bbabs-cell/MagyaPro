import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { countDifference, stockCountReason } from '@/lib/boutique/stock-count';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

export type StockCountInputLine = {
  productVariantId: string;
  /** Quantité trouvée en rayon, en unité de base. */
  counted: number;
  /** Stock que le logiciel affichait au moment où la ligne a été comptée. */
  expected: number;
};

/**
 * Valide un inventaire : un mouvement « Ajustement » par produit dont le
 * comptage diffère du stock attendu, tous dans une seule transaction — un
 * inventaire s'applique entièrement ou pas du tout, jamais à moitié.
 *
 * Seul l'écart est appliqué (voir `stock-count.ts`) : les ventes passées
 * pendant le comptage restent comptées. Le stock peut donc devenir négatif
 * si l'on a compté avant une vente qui n'était pas encore en rayon ; on
 * l'autorise ici plutôt que de refuser tout l'inventaire pour une ligne.
 */
export async function applyStockCount(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  lines: StockCountInputLine[];
  note?: string | null;
}) {
  if (params.lines.length === 0) {
    throw new ValidationError('Aucun produit compté.');
  }

  const ids = [...new Set(params.lines.map((line) => line.productVariantId))];
  if (ids.length !== params.lines.length) {
    throw new ValidationError('Un même produit apparaît deux fois dans le comptage.');
  }

  // Chaque variante doit appartenir à cette boutique : un identifiant venu du
  // navigateur ne désigne jamais le stock d'une autre.
  const owned = await prisma.storeProductVariant.findMany({
    where: { id: { in: ids }, product: { storeId: params.storeId } },
    select: { id: true, product: { select: { id: true } } },
  });
  if (owned.length !== ids.length) throw new NotFoundError('Produit introuvable.');

  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { storeId: params.storeId, isDefault: true },
    select: { id: true },
  });

  const countId = randomUUID();
  const adjustments = params.lines
    .map((line) => ({ ...line, change: countDifference(line.counted, line.expected) }))
    .filter((line) => line.change !== 0);

  await prisma.$transaction(
    async (tx) => {
      for (const line of adjustments) {
        await recordStockMovement(
          {
            storeId: params.storeId,
            productVariantId: line.productVariantId,
            warehouseId: warehouse.id,
            type: 'ADJUSTMENT',
            quantityChange: line.change,
            userId: params.userId,
            reason: stockCountReason(line.counted, line.expected, params.note),
            referenceType: 'stock_count',
            referenceId: countId,
            allowNegativeStock: true,
            silent: true,
          },
          tx,
        );
      }
    },
    // Un inventaire complet peut toucher des centaines de lignes.
    { timeout: 60_000, maxWait: 10_000 },
  );

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_STOCK_COUNTED,
    actorUserId: params.userId,
    actorEmail: params.userEmail,
    storeId: params.storeId,
    targetType: 'stock_count',
    targetId: countId,
    metadata: { counted: params.lines.length, adjusted: adjustments.length },
  });

  return { countId, counted: params.lines.length, adjusted: adjustments.length };
}
