import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { priceOrder } from '@/lib/orders/pricing';
import { createOrder } from '@/lib/orders/service';
import { formatMoney, percentOf, toMinor, toMajor } from '@/lib/money';

/**
 * Tarification des commandes.
 *
 * Le principe vérifié ici : le total ne dépend que de la base de données. Rien
 * de ce que le client envoie — hormis les identifiants et les quantités — ne
 * peut le modifier.
 */
describe('Moteur de tarification', () => {
  let shop: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant({ productPrice: 5000 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('calcule un sous-total à partir des prix en base', async () => {
    const priced = await priceOrder(prisma, {
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 3 }],
      fulfillmentType: 'PICKUP',
    });

    expect(priced.subtotal).toBe(15_000);
    expect(priced.total).toBe(15_000);
  });

  it('ignore tout prix transmis par le client', async () => {
    // Un panier trafiqué : le client déclare un prix unitaire de 1.
    const forged = {
      productId: shop.product.id,
      quantity: 2,
      unitPrice: 1,
      lineTotal: 2,
      price: 1,
    } as unknown as { productId: string; quantity: number };

    const priced = await priceOrder(prisma, {
      restaurantId: shop.restaurant.id,
      items: [forged],
      fulfillmentType: 'PICKUP',
    });

    expect(priced.subtotal).toBe(10_000);
  });

  it('applique le prix de la variante à la place du prix de base', async () => {
    const double = shop.product.variants.find((variant) => variant.name === 'Double');

    const priced = await priceOrder(prisma, {
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, variantId: double!.id, quantity: 1 }],
      fulfillmentType: 'PICKUP',
    });

    expect(priced.subtotal).toBe(10_000);
  });

  it('ajoute les suppléments des options choisies', async () => {
    const frites = shop.product.optionGroups[0]!.options.find(
      (option) => option.name === 'Frites',
    );

    const priced = await priceOrder(prisma, {
      restaurantId: shop.restaurant.id,
      items: [
        { productId: shop.product.id, optionIds: [frites!.id], quantity: 2 },
      ],
      fulfillmentType: 'PICKUP',
    });

    // (5000 + 500) × 2
    expect(priced.subtotal).toBe(11_000);
  });

  it("rejette une option qui n'appartient pas au produit", async () => {
    await expect(
      priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [
          { productId: shop.product.id, optionIds: ['option-inexistante'], quantity: 1 },
        ],
        fulfillmentType: 'PICKUP',
      }),
    ).rejects.toThrow(/n'est pas valide/i);
  });

  it('impose le nombre minimum d\'options d\'un groupe', async () => {
    const group = await prisma.productOptionGroup.update({
      where: { id: shop.product.optionGroups[0]!.id },
      data: { minSelect: 1 },
    });

    await expect(
      priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
      }),
    ).rejects.toThrow(/au moins/i);

    await prisma.productOptionGroup.update({
      where: { id: group.id },
      data: { minSelect: 0 },
    });
  });

  it('refuse un produit marqué indisponible', async () => {
    await prisma.product.update({
      where: { id: shop.product.id },
      data: { isAvailable: false },
    });

    await expect(
      priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
      }),
    ).rejects.toThrow(/plus disponible/i);

    await prisma.product.update({
      where: { id: shop.product.id },
      data: { isAvailable: true },
    });
  });

  describe('Livraison', () => {
    it('facture les frais de la zone choisie', async () => {
      const priced = await priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'DELIVERY',
        deliveryZoneId: shop.zone.id,
      });

      expect(priced.deliveryFee).toBe(1000);
      expect(priced.total).toBe(6000);
    });

    it('offre la livraison au-delà du seuil de la zone', async () => {
      // 5 × 5000 = 25 000, au-dessus du seuil de 20 000.
      const priced = await priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 5 }],
        fulfillmentType: 'DELIVERY',
        deliveryZoneId: shop.zone.id,
      });

      expect(priced.deliveryFee).toBe(0);
      expect(priced.total).toBe(25_000);
    });

    it('ne facture aucun frais pour un retrait sur place', async () => {
      const priced = await priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        deliveryZoneId: shop.zone.id,
      });

      expect(priced.deliveryFee).toBe(0);
    });
  });

  describe('Promotions', () => {
    it('applique une remise en pourcentage sur le sous-total seul', async () => {
      const priced = await priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 2 }],
        fulfillmentType: 'DELIVERY',
        deliveryZoneId: shop.zone.id,
        promoCode: 'TEST10',
      });

      // Sous-total 10 000, remise 10 % = 1 000, livraison 1 000 intacte.
      expect(priced.subtotal).toBe(10_000);
      expect(priced.discount).toBe(1000);
      expect(priced.deliveryFee).toBe(1000);
      expect(priced.total).toBe(10_000);
    });

    it('ne laisse jamais une remise fixe rendre le total négatif', async () => {
      await prisma.promotion.create({
        data: {
          restaurantId: shop.restaurant.id,
          code: 'ENORME',
          type: 'FIXED',
          value: 999_999,
        },
      });

      const priced = await priceOrder(prisma, {
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        promoCode: 'ENORME',
      });

      expect(priced.discount).toBe(5000);
      expect(priced.total).toBe(0);
    });

    it('refuse un code expiré', async () => {
      await prisma.promotion.create({
        data: {
          restaurantId: shop.restaurant.id,
          code: 'EXPIRE',
          type: 'PERCENT',
          value: 50,
          endsAt: new Date(Date.now() - 86_400_000),
        },
      });

      await expect(
        priceOrder(prisma, {
          restaurantId: shop.restaurant.id,
          items: [{ productId: shop.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
          promoCode: 'EXPIRE',
        }),
      ).rejects.toThrow(/expiré/i);
    });

    it("refuse un code ayant atteint sa limite d'utilisation", async () => {
      await prisma.promotion.create({
        data: {
          restaurantId: shop.restaurant.id,
          code: 'EPUISE',
          type: 'PERCENT',
          value: 20,
          maxRedemptions: 1,
          usedCount: 1,
        },
      });

      await expect(
        priceOrder(prisma, {
          restaurantId: shop.restaurant.id,
          items: [{ productId: shop.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
          promoCode: 'EPUISE',
        }),
      ).rejects.toThrow(/limite/i);
    });

    it('refuse un code sous le montant minimum', async () => {
      await prisma.promotion.create({
        data: {
          restaurantId: shop.restaurant.id,
          code: 'GROSPANIER',
          type: 'PERCENT',
          value: 15,
          minOrder: 50_000,
        },
      });

      await expect(
        priceOrder(prisma, {
          restaurantId: shop.restaurant.id,
          items: [{ productId: shop.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
          promoCode: 'GROSPANIER',
        }),
      ).rejects.toThrow(/montant minimum/i);
    });

    it('consomme le code une seule fois par commande', async () => {
      const before = await prisma.promotion.findUnique({
        where: { id: shop.promotion.id },
      });

      await createOrder({
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client promo',
        customerPhone: '+225 07 12 34 56',
        promoCode: 'TEST10',
        paymentProvider: 'pay_at_store',
      });

      const after = await prisma.promotion.findUnique({
        where: { id: shop.promotion.id },
      });
      expect(after!.usedCount).toBe(before!.usedCount + 1);
    });
  });

  describe('Montant minimum du restaurant', () => {
    it('refuse une commande en dessous du minimum configuré', async () => {
      const strict = await createTestRestaurant({
        minOrderAmount: 10_000,
        productPrice: 2000,
      });

      await expect(
        priceOrder(prisma, {
          restaurantId: strict.restaurant.id,
          items: [{ productId: strict.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
        }),
      ).rejects.toThrow(/minimum/i);
    });
  });

  describe('Restaurant non publié', () => {
    it("refuse toute commande chez un restaurant en brouillon", async () => {
      const draft = await createTestRestaurant({ status: 'DRAFT' });

      await expect(
        priceOrder(prisma, {
          restaurantId: draft.restaurant.id,
          items: [{ productId: draft.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
        }),
      ).rejects.toThrow(/n'accepte pas de commandes/i);
    });

    it('refuse toute commande chez un restaurant suspendu', async () => {
      const suspended = await createTestRestaurant({ status: 'SUSPENDED' });

      await expect(
        priceOrder(prisma, {
          restaurantId: suspended.restaurant.id,
          items: [{ productId: suspended.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
        }),
      ).rejects.toThrow(/n'accepte pas de commandes/i);
    });
  });
});

describe('Manipulation des montants', () => {
  it('convertit sans perte pour une devise sans décimale', () => {
    expect(toMinor('3000', 'XOF')).toBe(3000);
    expect(toMajor(3000, 'XOF')).toBe(3000);
  });

  it('convertit correctement pour une devise à deux décimales', () => {
    expect(toMinor('12,50', 'EUR')).toBe(1250);
    expect(toMinor(12.5, 'EUR')).toBe(1250);
    expect(toMajor(1250, 'EUR')).toBe(12.5);
  });

  it('évite les erreurs de virgule flottante sur une addition répétée', () => {
    // 0,1 + 0,2 en flottant vaut 0,30000000000000004. En unité mineure,
    // l'addition est exacte.
    const total = toMinor('0,10', 'EUR') + toMinor('0,20', 'EUR');
    expect(total).toBe(30);
    expect(toMajor(total, 'EUR')).toBe(0.3);
  });

  it('arrondit les pourcentages au plus proche', () => {
    expect(percentOf(1000, 10)).toBe(100);
    expect(percentOf(333, 10)).toBe(33);
    expect(percentOf(335, 10)).toBe(34);
  });

  it('formate un montant dans la devise demandée', () => {
    expect(formatMoney(5000, 'XOF')).toContain('5');
    expect(formatMoney(1250, 'EUR')).toContain('12,50');
  });
});
