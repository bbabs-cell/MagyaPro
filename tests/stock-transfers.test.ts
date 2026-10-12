import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, addStoreMember, createTestStore, resetDatabase, type TestStore } from './helpers';
import {
  cancelTransfer,
  createTransfer,
  listTransferDestinations,
  listTransfers,
  receiveTransfer,
} from '@/lib/boutique/transfers-service';

/**
 * Transferts entre deux boutiques du même propriétaire : `a` envoie, `b` reçoit.
 */
describe('Transferts de stock entre boutiques', () => {
  let a: TestStore;
  let b: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    a = await createTestStore({ name: 'Boutique Plateau', initialStock: 50, variantPrice: 700, variantCost: 400 });
    b = await createTestStore({ name: 'Boutique Médina' });
    // Le propriétaire de `a` gère aussi `b`.
    await prisma.storeUser.create({ data: { storeId: b.store.id, userId: a.owner.id, role: 'OWNER' } });
    await prisma.storeProductVariant.update({ where: { id: a.variant.id }, data: { barcode: '6001234567890', sku: 'EAU-15' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const stockOf = async (variantId: string, warehouseId: string) => {
    const row = await prisma.inventory.findUnique({
      where: { productVariantId_warehouseId: { productVariantId: variantId, warehouseId } },
    });
    return row ? row.quantity.toNumber() : 0;
  };

  const send = (quantity: number, variantId = a.variant.id) =>
    createTransfer({
      storeId: a.store.id,
      userId: a.owner.id,
      userEmail: a.owner.email,
      destinationStoreId: b.store.id,
      items: [{ productVariantId: variantId, quantity }],
      note: 'Livré par Moussa',
    });

  it('propose seulement les boutiques dont on gère le stock', async () => {
    const destinations = await listTransferDestinations(a.store.id, a.owner.id);
    expect(destinations.map((store) => store.id)).toEqual([b.store.id]);
    // Le propriétaire de `b` n'est pas membre de `a`.
    expect(await listTransferDestinations(b.store.id, b.owner.id)).toEqual([]);
  });

  it("retire le stock à l'envoi, sans rien ajouter à l'arrivée avant la réception", async () => {
    const transfer = await send(12);
    expect(transfer.status).toBe('IN_TRANSIT');
    expect(await stockOf(a.variant.id, a.warehouse.id)).toBe(38);
    expect(await prisma.storeProduct.count({ where: { storeId: b.store.id, name: 'Produit test' } })).toBe(1);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { referenceId: transfer.id } });
    expect(movement).toMatchObject({ type: 'TRANSFER_OUT', reason: 'Transfert vers Boutique Médina' });

    const notification = await prisma.notification.findFirst({ where: { storeId: b.store.id } });
    expect(notification?.title).toBe('Transfert en route depuis Boutique Plateau');

    const rows = await listTransfers(b.store.id);
    expect(rows[0]).toMatchObject({ direction: 'in', otherStore: 'Boutique Plateau', status: 'IN_TRANSIT' });
  });

  it('à la réception, crée la fiche manquante par copie et y entre le stock', async () => {
    // `b` a un « Produit test » avec un autre code-barres et une autre référence
    // — mais le même nom : c'est lui qui est retenu, sans copie.
    const transfer = (await listTransfers(b.store.id)).find((t) => t.status === 'IN_TRANSIT')!;
    const result = await receiveTransfer({
      storeId: b.store.id,
      userId: a.owner.id,
      userEmail: a.owner.email,
      transferId: transfer.id,
    });
    expect(result).toEqual({ received: 1, createdProducts: 0 });
    expect(await stockOf(b.variant.id, b.warehouse.id)).toBe(20 + 12);

    // Une seconde réception du même transfert est refusée.
    await expect(
      receiveTransfer({ storeId: b.store.id, userId: a.owner.id, userEmail: a.owner.email, transferId: transfer.id }),
    ).rejects.toThrow('déjà été réceptionné');
  });

  it("crée la fiche dans la boutique d'arrivée quand elle n'existe pas", async () => {
    const product = await prisma.storeProduct.create({
      data: {
        storeId: a.store.id,
        name: 'Huile Dinor 1 L',
        status: 'ACTIVE',
        variants: { create: { price: 1500, cost: 1100, barcode: '6009876543210' } },
      },
      include: { variants: true },
    });
    const variant = product.variants[0]!;
    await prisma.inventory.create({ data: { productVariantId: variant.id, warehouseId: a.warehouse.id, quantity: 30 } });

    const transfer = await send(10, variant.id);
    const result = await receiveTransfer({
      storeId: b.store.id,
      userId: a.owner.id,
      userEmail: a.owner.email,
      transferId: transfer.id,
    });
    expect(result.createdProducts).toBe(1);

    const copy = await prisma.storeProductVariant.findFirstOrThrow({
      where: { barcode: '6009876543210', product: { storeId: b.store.id } },
      include: { product: true },
    });
    expect(copy).toMatchObject({ price: 1500, cost: 1100 });
    expect(copy.product.name).toBe('Huile Dinor 1 L');
    expect(await stockOf(copy.id, b.warehouse.id)).toBe(10);
  });

  it("annule un envoi en route : le stock revient, et la réception devient impossible", async () => {
    const before = await stockOf(a.variant.id, a.warehouse.id);
    const transfer = await send(5);
    expect(await stockOf(a.variant.id, a.warehouse.id)).toBe(before - 5);

    await cancelTransfer({ storeId: a.store.id, userId: a.owner.id, userEmail: a.owner.email, transferId: transfer.id });
    expect(await stockOf(a.variant.id, a.warehouse.id)).toBe(before);

    await expect(
      receiveTransfer({ storeId: b.store.id, userId: a.owner.id, userEmail: a.owner.email, transferId: transfer.id }),
    ).rejects.toThrow('annulé');
  });

  it("ne laisse ni réceptionner depuis la boutique de départ, ni annuler depuis celle d'arrivée", async () => {
    const transfer = await send(1);
    await expect(
      receiveTransfer({ storeId: a.store.id, userId: a.owner.id, userEmail: a.owner.email, transferId: transfer.id }),
    ).rejects.toThrow('introuvable');
    await expect(
      cancelTransfer({ storeId: b.store.id, userId: a.owner.id, userEmail: a.owner.email, transferId: transfer.id }),
    ).rejects.toThrow('introuvable');
  });

  it("refuse d'envoyer plus que le stock, et n'écrit alors rien", async () => {
    const before = await prisma.stockTransfer.count();
    await expect(send(10_000)).rejects.toThrow('Stock insuffisant');
    expect(await prisma.stockTransfer.count()).toBe(before);
  });

  it("refuse une boutique d'arrivée que l'on ne gère pas, et le produit d'une autre boutique", async () => {
    const stranger = await createTestStore({ name: 'Boutique étrangère' });
    await expect(
      createTransfer({
        storeId: a.store.id,
        userId: a.owner.id,
        userEmail: a.owner.email,
        destinationStoreId: stranger.store.id,
        items: [{ productVariantId: a.variant.id, quantity: 1 }],
      }),
    ).rejects.toThrow("Vous ne gérez pas le stock de la boutique d'arrivée.");

    // Un caissier de la boutique d'arrivée ne suffit pas non plus.
    const { user: cashier } = await addStoreMember(b.store.id, 'CASHIER');
    await prisma.storeUser.create({ data: { storeId: a.store.id, userId: cashier.id, role: 'OWNER' } });
    await expect(
      createTransfer({
        storeId: a.store.id,
        userId: cashier.id,
        userEmail: cashier.email,
        destinationStoreId: b.store.id,
        items: [{ productVariantId: a.variant.id, quantity: 1 }],
      }),
    ).rejects.toThrow("Vous ne gérez pas le stock de la boutique d'arrivée.");

    await expect(send(1, b.variant.id)).rejects.toThrow('Produit introuvable');
  });
});
