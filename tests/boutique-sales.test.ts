import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { createSale } from '@/lib/boutique/sales-service';
import { recordStockMovement } from '@/lib/boutique/inventory';

/**
 * Vente (caisse/POS) : tarification, stock, crédit — le cœur métier de
 * Boutique. Le principe vérifié : le total ne dépend que de la base de
 * données, jamais de ce que le client (caisse compromise, requête forgée)
 * pourrait envoyer en plus des identifiants et quantités.
 */
describe('Vente — tarification', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 5000, initialStock: 20 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('calcule un sous-total à partir du prix en base', async () => {
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

    expect(sale.subtotal).toBe(15_000);
    expect(sale.total).toBe(15_000);
  });

  it('ignore tout prix transmis par le client', async () => {
    const forged = {
      productVariantId: shop.variant.id,
      quantity: 2,
      unitPrice: 1,
      price: 1,
    } as unknown as { productVariantId: string; quantity: number };

    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [forged],
        payments: [{ method: 'cash', amount: 10_000 }],
        discount: 0,
      },
    });

    expect(sale.subtotal).toBe(10_000);
  });

  it('applique une remise manuelle sans dépasser le sous-total', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 0 }],
        discount: 999_999, // largement supérieur au sous-total (5000)
      },
    });

    expect(sale.discount).toBe(5000);
    expect(sale.total).toBe(0);
  });

  it('applique et recalcule le rabais du code promo, jamais un montant transmis', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }], // 10 000
        payments: [{ method: 'cash', amount: 9000 }],
        discount: 0,
        promoCode: 'test10', // casse volontairement différente : normalisé en majuscules
      },
    });

    // 10% de 10 000 = 1 000
    expect(sale.discount).toBe(1000);
    expect(sale.total).toBe(9000);
  });

  it('rejette un code promo inconnu', async () => {
    await expect(
      createSale({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          items: [{ productVariantId: shop.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 5000 }],
          discount: 0,
          promoCode: 'INCONNU',
        },
      }),
    ).rejects.toThrow(/code promo/i);
  });

  it('applique la TVA de la boutique quand elle est activée', async () => {
    const taxedShop = await createTestStore({ variantPrice: 10_000, taxEnabled: true, taxRate: 180 });

    const sale = await createSale({
      storeId: taxedShop.store.id,
      userId: taxedShop.owner.id,
      userEmail: taxedShop.owner.email,
      input: {
        items: [{ productVariantId: taxedShop.variant.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 11_800 }],
        discount: 0,
      },
    });

    expect(sale.subtotal).toBe(10_000);
    expect(sale.taxAmount).toBe(1800); // 18 % de 10 000
    expect(sale.total).toBe(11_800);
  });
});

describe('Vente — paiements scindés et crédit', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 10_000, initialStock: 20 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('combine plusieurs moyens de paiement dont la somme couvre le total', async () => {
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 6000 },
          { method: 'orange_money', amount: 4000 },
        ],
        discount: 0,
      },
    });

    expect(sale.total).toBe(10_000);
    expect(sale.creditAmount).toBe(0);

    const payments = await prisma.storePayment.findMany({ where: { saleId: sale.id } });
    expect(payments).toHaveLength(2);
  });

  it('rejette un total de paiements supérieur au montant de la vente', async () => {
    await expect(
      createSale({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          items: [{ productVariantId: shop.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 50_000 }],
          discount: 0,
        },
      }),
    ).rejects.toThrow(/dépasse/i);
  });

  it('met le reste non couvert à crédit sur le client choisi', async () => {
    const customer = await prisma.storeCustomer.create({
      data: { storeId: shop.store.id, name: 'Client crédit', phone: '+225 07 10 10 10', creditLimit: 0 },
    });

    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 4000 }],
        discount: 0,
        customerId: customer.id,
      },
    });

    expect(sale.creditAmount).toBe(6000);

    const updated = await prisma.storeCustomer.findUnique({ where: { id: customer.id } });
    expect(updated!.creditBalance).toBe(6000);
  });

  it('exige un client dès que les paiements ne couvrent pas le total', async () => {
    await expect(
      createSale({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          items: [{ productVariantId: shop.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 1000 }],
          discount: 0,
        },
      }),
    ).rejects.toThrow(/client/i);
  });

  it('refuse une vente à crédit qui dépasserait la limite du client', async () => {
    const customer = await prisma.storeCustomer.create({
      data: {
        storeId: shop.store.id,
        name: 'Client limité',
        phone: '+225 07 20 20 20',
        creditLimit: 3000,
      },
    });

    await expect(
      createSale({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          items: [{ productVariantId: shop.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 0 }],
          discount: 0,
          customerId: customer.id,
        },
      }),
    ).rejects.toThrow(/limite de crédit/i);
  });
});

describe('Vente — stock', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 1000, initialStock: 5 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('décrémente le stock à la vente', async () => {
    await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }],
        payments: [{ method: 'cash', amount: 2000 }],
        discount: 0,
      },
    });

    const inventory = await prisma.inventory.findFirst({ where: { productVariantId: shop.variant.id } });
    expect(Number(inventory!.quantity)).toBe(3);
  });

  it('refuse une vente qui dépasse le stock disponible et ne modifie rien', async () => {
    const before = await prisma.inventory.findFirst({ where: { productVariantId: shop.variant.id } });

    await expect(
      createSale({
        storeId: shop.store.id,
        userId: shop.owner.id,
        userEmail: shop.owner.email,
        input: {
          items: [{ productVariantId: shop.variant.id, quantity: 999 }],
          payments: [{ method: 'cash', amount: 999_000 }],
          discount: 0,
        },
      }),
    ).rejects.toThrow(/stock insuffisant/i);

    const after = await prisma.inventory.findFirst({ where: { productVariantId: shop.variant.id } });
    expect(Number(after!.quantity)).toBe(Number(before!.quantity));

    // Aucune vente partielle : la transaction entière a été annulée.
    const salesCount = await prisma.sale.count({ where: { storeId: shop.store.id } });
    expect(salesCount).toBe(1); // seulement celle du test précédent
  });

  it("refuse un mouvement de stock qui ferait passer la quantité sous zéro", async () => {
    await expect(
      recordStockMovement({
        storeId: shop.store.id,
        productVariantId: shop.variant.id,
        warehouseId: shop.warehouse.id,
        type: 'ADJUSTMENT',
        quantityChange: -1000,
      }),
    ).rejects.toThrow(/stock insuffisant/i);
  });
});
