import ExcelJS from 'exceljs';

import { fail, ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { ValidationError } from '@/lib/errors';

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text);
  return String(value);
}

/**
 * Réimport du catalogue exporté (`/api/boutique/produits/export`) — seules
 * les colonnes Prix, Coût et Stock sont appliquées ; la colonne ID identifie
 * la variante et est ignorée si elle ne correspond à aucune variante de
 * *cette* boutique (isolation multi-tenant, jamais une simple recherche
 * globale par identifiant). Une ligne invalide n'annule pas les autres :
 * chacune est traitée indépendamment, le rapport final liste les échecs.
 */
export const POST = route(async (request) => {
  const context = await requireStore('products:manage');
  hit(`boutique-import:${context.store.id}`, RATE_LIMITS.upload);

  const formData = await request.formData().catch(() => null);
  if (!formData) return fail('Requête de téléversement invalide.', 400, 'VALIDATION_ERROR');

  const file = formData.get('file');
  if (!(file instanceof File)) throw new ValidationError('Aucun fichier reçu.');

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new ValidationError('Fichier Excel illisible.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationError('Le fichier ne contient aucune feuille.');

  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const id = cellString(row.getCell(1).value).trim();
    if (!id) continue;

    const price = cellNumber(row.getCell(6).value);
    const cost = cellNumber(row.getCell(7).value);
    const stock = cellNumber(row.getCell(8).value);

    const variant = await prisma.storeProductVariant.findFirst({
      where: { id, product: { storeId: context.store.id } },
      select: { id: true, price: true, cost: true, inventory: { where: { warehouseId: defaultWarehouse.id }, select: { quantity: true } } },
    });
    if (!variant) {
      errors.push({ row: rowNumber, message: 'Identifiant introuvable dans cette boutique.' });
      continue;
    }

    try {
      const data: { price?: number; cost?: number } = {};
      if (price !== null && price !== variant.price) data.price = Math.round(price);
      if (cost !== null && cost !== variant.cost) data.cost = Math.round(cost);
      if (Object.keys(data).length > 0) {
        await prisma.storeProductVariant.update({ where: { id: variant.id }, data });
      }

      if (stock !== null) {
        const currentStock = variant.inventory[0] ? toQty(variant.inventory[0].quantity) : 0;
        const delta = stock - currentStock;
        if (Math.abs(delta) > 0.0005) {
          await recordStockMovement({
            storeId: context.store.id,
            productVariantId: variant.id,
            warehouseId: defaultWarehouse.id,
            type: 'ADJUSTMENT',
            quantityChange: delta,
            userId: context.user.id,
            reason: 'Import Excel',
          });
        }
      }

      updated++;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Échec de la mise à jour.',
      });
    }
  }

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCTS_IMPORTED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product_import',
    targetId: context.store.id,
    metadata: { updated, errorCount: errors.length },
  });

  return ok({ updated, errors });
});
