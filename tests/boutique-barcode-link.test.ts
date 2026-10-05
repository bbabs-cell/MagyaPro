import { beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { linkVariantBarcode } from '@/lib/boutique/barcode-link';

/**
 * Associer un code-barres depuis la caisse : le code lu est rattaché au bon
 * article, une seule fois par boutique, et jamais à l'article d'une autre
 * boutique.
 */
describe('Code-barres — association depuis la caisse', () => {
  let shop: TestStore;
  let other: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 500, initialStock: 10 });
    other = await createTestStore({ variantPrice: 500, initialStock: 10 });
  });

  it('enregistre le code sur la déclinaison', async () => {
    await linkVariantBarcode(shop.store.id, shop.variant.id, '6111245678901');
    const variant = await prisma.storeProductVariant.findUnique({ where: { id: shop.variant.id } });
    expect(variant?.barcode).toBe('6111245678901');
  });

  it("refuse la déclinaison d'une autre boutique, comme si elle n'existait pas", async () => {
    await expect(linkVariantBarcode(shop.store.id, other.variant.id, '123456789')).rejects.toMatchObject({ status: 404 });
    const variant = await prisma.storeProductVariant.findUnique({ where: { id: other.variant.id } });
    expect(variant?.barcode).not.toBe('123456789');
  });

  it('refuse un code déjà porté par un autre article de la même boutique', async () => {
    const second = await prisma.storeProductVariant.create({
      data: { productId: shop.variant.productId, price: 700 },
    });
    await expect(linkVariantBarcode(shop.store.id, second.id, '6111245678901')).rejects.toMatchObject({ status: 409 });
  });

  it("accepte le même code dans une autre boutique : deux commerces vendent le même article", async () => {
    await expect(linkVariantBarcode(other.store.id, other.variant.id, '6111245678901')).resolves.toBeTruthy();
  });
});
