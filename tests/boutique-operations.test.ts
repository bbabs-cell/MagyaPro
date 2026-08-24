import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { createSale } from '@/lib/boutique/sales-service';
import { createPurchaseOrder, receivePurchaseOrder } from '@/lib/boutique/purchases-service';
import { createReturn } from '@/lib/boutique/returns-service';
import { openCashSession, closeCashSession } from '@/lib/boutique/cash-service';

/**
 * Achats, retours, caisse — le reste du cœur métier Boutique, même
 * principe que `boutique-sales.test.ts` : chaque fonction est appelée
 * directement, sans passer par une requête HTTP authentifiée.
 */
describe('Achats', () => {
  let shop: TestStore;
  let supplier: Awaited<ReturnType<typeof prisma.supplier.create>>;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantCost: 3000, initialStock: 5 });
    supplier = await prisma.supplier.create({
      data: { storeId: shop.store.id, name: 'Fournisseur test' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crée une commande avec un numéro de référence propre à la boutique', async () => {
    const order = await createPurchaseOrder({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        supplierId: supplier.id,
        items: [{ productVariantId: shop.variant.id, quantity: 10, unitCost: 2500 }],
      },
    });

    expect(order.reference).toBe('PO-0001');
    expect(order.status).toBe('ORDERED');
  });

  it("refuse une commande pour le fournisseur d'une autre boutique", async () => {
    const other = await createTestStore();
    const otherSupplier = await prisma.supplier.create({
      data: { storeId: other.store.id, name: 'Fournisseur Beta' },
    });

    await expect(
      createPurchaseOrder({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          supplierId: otherSupplier.id,
          items: [{ productVariantId: shop.variant.id, quantity: 1, unitCost: 1000 }],
        },
      }),
    ).rejects.toThrow(/fournisseur introuvable/i);
  });

  it('la réception augmente le stock, met à jour le coût et la dette fournisseur', async () => {
    const order = await createPurchaseOrder({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        supplierId: supplier.id,
        items: [{ productVariantId: shop.variant.id, quantity: 10, unitCost: 2500 }],
      },
    });

    const stockBefore = await prisma.inventory.findFirst({
      where: { productVariantId: shop.variant.id, warehouseId: shop.warehouse.id },
    });

    const { totalCost } = await receivePurchaseOrder({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      purchaseOrderId: order.id,
    });

    expect(totalCost).toBe(25_000);

    const stockAfter = await prisma.inventory.findFirst({
      where: { productVariantId: shop.variant.id, warehouseId: shop.warehouse.id },
    });
    expect(Number(stockAfter!.quantity)).toBe(Number(stockBefore!.quantity) + 10);

    const variant = await prisma.storeProductVariant.findUnique({ where: { id: shop.variant.id } });
    expect(variant!.cost).toBe(2500);

    const updatedSupplier = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    expect(updatedSupplier!.debtBalance).toBe(25_000);
  });

  it('refuse de réceptionner deux fois la même commande', async () => {
    const order = await createPurchaseOrder({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        supplierId: supplier.id,
        items: [{ productVariantId: shop.variant.id, quantity: 1, unitCost: 1000 }],
      },
    });

    await receivePurchaseOrder({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      purchaseOrderId: order.id,
    });

    await expect(
      receivePurchaseOrder({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        purchaseOrderId: order.id,
      }),
    ).rejects.toThrow(/déjà été réceptionnée/i);
  });
});

describe('Retours', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 5000, initialStock: 20 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rembourse un retour et ré-approvisionne le stock', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 3 }],
        payments: [{ method: 'cash', amount: 15_000 }],
        discount: 0,
      },
    });

    const stockBefore = await prisma.inventory.findFirst({ where: { productVariantId: shop.variant.id } });

    const storeReturn = await createReturn({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        saleId: sale.id,
        resolution: 'REFUND',
        items: [{ productVariantId: shop.variant.id, quantity: 1 }],
      },
    });

    expect(storeReturn.items).toHaveLength(1);

    const stockAfter = await prisma.inventory.findFirst({ where: { productVariantId: shop.variant.id } });
    expect(Number(stockAfter!.quantity)).toBe(Number(stockBefore!.quantity) + 1);

    const updatedSale = await prisma.sale.findUnique({ where: { id: sale.id } });
    expect(updatedSale!.status).toBe('PARTIALLY_REFUNDED');
  });

  it('passe la vente à REFUNDED une fois tout retourné', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10_000 }],
        discount: 0,
      },
    });

    await createReturn({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        saleId: sale.id,
        resolution: 'REFUND',
        items: [{ productVariantId: shop.variant.id, quantity: 2 }],
      },
    });

    const updatedSale = await prisma.sale.findUnique({ where: { id: sale.id } });
    expect(updatedSale!.status).toBe('REFUNDED');
  });

  it('refuse un retour supérieur à la quantité vendue, y compris cumulé sur plusieurs retours', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10_000 }],
        discount: 0,
      },
    });

    await createReturn({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        saleId: sale.id,
        resolution: 'REFUND',
        items: [{ productVariantId: shop.variant.id, quantity: 1 }],
      },
    });

    await expect(
      createReturn({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          saleId: sale.id,
          resolution: 'REFUND',
          items: [{ productVariantId: shop.variant.id, quantity: 2 }],
        },
      }),
    ).rejects.toThrow(/supérieure à ce qui peut encore être retourné/i);
  });

  it("refuse le retour d'une vente d'une autre boutique", async () => {
    const other = await createTestStore({ variantPrice: 5000, initialStock: 10 });
    const otherSale = await createSale({
      storeId: other.store.id,
      userId: other.owner.id,
      userEmail: other.owner.email,
      input: {
        items: [{ productVariantId: other.variant.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 5000 }],
        discount: 0,
      },
    });

    await expect(
      createReturn({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          saleId: otherSale.id,
          resolution: 'REFUND',
          items: [{ productVariantId: other.variant.id, quantity: 1 }],
        },
      }),
    ).rejects.toThrow(/vente introuvable/i);
  });
});

describe('Caisse', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 5000, initialStock: 20 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('ouvre une session avec le fond de caisse déclaré', async () => {
    const session = await openCashSession({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      openingBalance: 20_000,
    });

    expect(session.status).toBe('OPEN');
    expect(session.openingBalance).toBe(20_000);
  });

  it('refuse une seconde ouverture tant qu\'une session est en cours', async () => {
    await expect(
      openCashSession({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        openingBalance: 10_000,
      }),
    ).rejects.toThrow(/déjà ouverte/i);
  });

  it('calcule le solde théorique à partir des ventes en espèces et rattache les ventes à la session ouverte', async () => {
    const openSession = await prisma.cashSession.findFirst({
      where: { storeId: shop.store.id, status: 'OPEN' },
    });

    await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }], // 10 000
        payments: [{ method: 'cash', amount: 10_000 }],
        discount: 0,
      },
    });
    await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 1 }], // 5 000, payé par carte
        payments: [{ method: 'card', amount: 5000 }],
        discount: 0,
      },
    });

    const linkedSales = await prisma.sale.findMany({ where: { cashSessionId: openSession!.id } });
    expect(linkedSales).toHaveLength(2);

    // Fond de caisse 20 000 + 10 000 de ventes en espèces (la vente carte
    // n'entre pas dans le solde espèces) = 30 000 attendu.
    const closed = await closeCashSession({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      sessionId: openSession!.id,
      countedBalance: 30_000,
    });

    expect(closed.expectedBalance).toBe(30_000);
    expect(closed.difference).toBe(0);
    expect(closed.status).toBe('CLOSED');
  });

  it('conserve un écart quand le comptage ne correspond pas au solde théorique', async () => {
    const session = await openCashSession({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      openingBalance: 5000,
    });

    const closed = await closeCashSession({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      sessionId: session.id,
      countedBalance: 4500,
    });

    expect(closed.expectedBalance).toBe(5000);
    expect(closed.difference).toBe(-500);
  });

  it('refuse de fermer une session déjà fermée', async () => {
    const session = await prisma.cashSession.findFirst({
      where: { storeId: shop.store.id, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
    });

    await expect(
      closeCashSession({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        sessionId: session!.id,
        countedBalance: 0,
      }),
    ).rejects.toThrow(/déjà fermée/i);
  });
});
