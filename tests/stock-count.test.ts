import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import {
  countDifference,
  countedBaseQuantity,
  stockCountReason,
  summarizeCount,
} from '@/lib/boutique/stock-count';
import { applyStockCount } from '@/lib/boutique/stock-count-service';
import { recordStockMovement } from '@/lib/boutique/inventory';

describe('Inventaire guidé — calculs', () => {
  const units = [
    { unitId: 'carton', factor: 12, isBase: false },
    { unitId: 'bouteille', factor: 1, isBase: true },
  ];

  it('additionne cartons et bouteilles en unité de base', () => {
    expect(countedBaseQuantity({ carton: '3', bouteille: '4' }, units)).toBe(40);
    expect(countedBaseQuantity({ bouteille: '0' }, units)).toBe(0);
    expect(countedBaseQuantity({ bouteille: '1,5' }, units)).toBe(1.5);
  });

  it("distingue « pas encore compté » d'un zéro", () => {
    expect(countedBaseQuantity({}, units)).toBeNull();
    expect(countedBaseQuantity({ carton: '', bouteille: ' ' }, units)).toBeNull();
    expect(countedBaseQuantity({ bouteille: '-2' }, units)).toBeNull();
  });

  it('résume les écarts et leur valeur au coût', () => {
    const summary = summarizeCount([
      { variantId: 'a', counted: 12, expected: 15, unitCost: 500 },
      { variantId: 'b', counted: 8, expected: 8, unitCost: 1000 },
      { variantId: 'c', counted: 5, expected: 3, unitCost: 250 },
    ]);
    expect(summary).toEqual({ counted: 3, matching: 1, withGap: 2, missingValue: 1500, surplusValue: 500 });
    expect(countDifference(0.3, 0.1)).toBe(0.2);
  });

  it("écrit un motif relisible dans l'historique", () => {
    expect(stockCountReason(12, 15)).toBe('Inventaire : compté 12, attendu 15');
    expect(stockCountReason(1.5, 2, ' fin de mois ')).toBe('Inventaire : compté 1,5, attendu 2 — fin de mois');
  });
});

describe('Inventaire guidé — validation', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ initialStock: 15 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function stock(): Promise<number> {
    const row = await prisma.inventory.findFirstOrThrow({
      where: { productVariantId: shop.variant.id, warehouseId: shop.warehouse.id },
    });
    return row.quantity.toNumber();
  }

  it("applique l'écart sans effacer les ventes faites pendant le comptage", async () => {
    // Compté 12 alors que le logiciel en attendait 15…
    // …puis 2 vendus avant la validation.
    await recordStockMovement({
      storeId: shop.store.id,
      productVariantId: shop.variant.id,
      warehouseId: shop.warehouse.id,
      type: 'SALE',
      quantityChange: -2,
    });

    const result = await applyStockCount({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      lines: [{ productVariantId: shop.variant.id, counted: 12, expected: 15 }],
      note: 'fin de mois',
    });

    expect(result).toMatchObject({ counted: 1, adjusted: 1 });
    expect(await stock()).toBe(10);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { referenceType: 'stock_count', referenceId: result.countId },
    });
    expect(movement.type).toBe('ADJUSTMENT');
    expect(movement.quantityChange.toNumber()).toBe(-3);
    expect(movement.userId).toBe(shop.owner.id);
    expect(movement.reason).toBe('Inventaire : compté 12, attendu 15 — fin de mois');
  });

  it("n'écrit rien pour une ligne conforme et n'envoie pas d'alerte de stock", async () => {
    const before = await prisma.inventoryMovement.count({ where: { storeId: shop.store.id } });
    const notificationsBefore = await prisma.notification.count({ where: { storeId: shop.store.id } });

    const conforme = await applyStockCount({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      lines: [{ productVariantId: shop.variant.id, counted: 10, expected: 10 }],
    });
    expect(conforme.adjusted).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { storeId: shop.store.id } })).toBe(before);

    // Passe sous le seuil d'alerte (5) puis à zéro : correction voulue, pas d'alerte.
    await applyStockCount({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      lines: [{ productVariantId: shop.variant.id, counted: 0, expected: 10 }],
    });
    expect(await stock()).toBe(0);
    expect(await prisma.notification.count({ where: { storeId: shop.store.id } })).toBe(notificationsBefore);
  });

  it("refuse le produit d'une autre boutique et n'applique rien", async () => {
    const other = await createTestStore();
    await expect(
      applyStockCount({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        lines: [
          { productVariantId: shop.variant.id, counted: 50, expected: 0 },
          { productVariantId: other.variant.id, counted: 0, expected: 20 },
        ],
      }),
    ).rejects.toThrow('Produit introuvable');
    expect(await stock()).toBe(0);
  });

  it('refuse un produit compté deux fois', async () => {
    await expect(
      applyStockCount({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        lines: [
          { productVariantId: shop.variant.id, counted: 1, expected: 0 },
          { productVariantId: shop.variant.id, counted: 2, expected: 0 },
        ],
      }),
    ).rejects.toThrow('deux fois');
  });
});
