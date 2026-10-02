import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { createSale } from '@/lib/boutique/sales-service';

/**
 * Une vente renvoyée ne doit pas être créée deux fois.
 *
 * Le cas réel : le serveur enregistre la vente, la réponse se perd sur un
 * réseau instable, la caisse croit à une panne et la renvoie au retour du
 * réseau. Sans identifiant de requête, le serveur la créait une seconde fois
 * — vente en double, stock décompté deux fois.
 */
describe('Vente — renvoi après une réponse perdue', () => {
  let shop: TestStore;

  const stockOf = async () => {
    const rows = await prisma.inventory.findMany({ where: { productVariantId: shop.variant.id } });
    return rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  };

  const sell = (clientRequestId?: string, quantity = 2) =>
    createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity }],
        payments: [{ method: 'cash', amount: 5000 * quantity }],
        discount: 0,
        clientRequestId,
      },
    });

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 5000, initialStock: 20 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rend la vente déjà créée, sans la refaire ni retoucher le stock', async () => {
    const id = randomUUID();
    const before = await stockOf();

    const first = await sell(id);
    const replay = await sell(id);

    expect(replay.id).toBe(first.id);
    expect(replay.number).toBe(first.number);
    expect(await prisma.sale.count({ where: { storeId: shop.store.id, clientRequestId: id } })).toBe(1);
    // Décompté une seule fois.
    expect(await stockOf()).toBe(before - 2);
  });

  it('rend la vente même si le stock ne la permettrait plus', async () => {
    // Entre l'envoi et le renvoi, le stock a pu s'épuiser : la vente a pourtant
    // bien eu lieu. La revalider la ferait refuser, et la caisse la croirait
    // perdue.
    const id = randomUUID();
    const first = await sell(id, 1);
    await prisma.inventory.updateMany({
      where: { productVariantId: shop.variant.id },
      data: { quantity: 0 },
    });
    const replay = await sell(id, 1);
    expect(replay.id).toBe(first.id);
  });

  it('dédoublonne deux renvois simultanés', async () => {
    await prisma.inventory.updateMany({
      where: { productVariantId: shop.variant.id },
      data: { quantity: 50 },
    });
    const id = randomUUID();
    const counterBefore = (await prisma.store.findUniqueOrThrow({ where: { id: shop.store.id } })).saleCounter;

    const [a, b] = await Promise.all([sell(id), sell(id)]);

    expect(a.id).toBe(b.id);
    expect(await prisma.sale.count({ where: { storeId: shop.store.id, clientRequestId: id } })).toBe(1);
    // La transaction perdante est annulée en entier : pas de numéro sauté.
    const counterAfter = (await prisma.store.findUniqueOrThrow({ where: { id: shop.store.id } })).saleCounter;
    expect(counterAfter).toBe(counterBefore + 1);
    expect(await stockOf()).toBe(48);
  });

  it('laisse les ventes sans identifiant se comporter comme avant', async () => {
    const a = await sell(undefined, 1);
    const b = await sell(undefined, 1);
    expect(a.id).not.toBe(b.id);
  });
});
