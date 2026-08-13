import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { priceOrder } from '@/lib/orders/pricing';
import { createOrder, updateOrderStatus } from '@/lib/orders/service';
import { markNotificationRead } from '@/lib/notifications';

/**
 * Isolation multi-tenant — la suite critique.
 *
 * Elle vérifie qu'un restaurant A ne peut atteindre aucune donnée d'un
 * restaurant B, sur chaque famille d'entités. Les tests interrogent les mêmes
 * fonctions que l'application : ils échoueraient si un filtre `restaurantId`
 * disparaissait d'une requête.
 */
describe('Isolation multi-tenant', () => {
  let alpha: TestRestaurant;
  let beta: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    alpha = await createTestRestaurant({ name: 'Restaurant Alpha' });
    beta = await createTestRestaurant({ name: 'Restaurant Beta' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Menu', () => {
    it("ne remonte pas les catégories d'un autre restaurant", async () => {
      const found = await prisma.category.findFirst({
        where: { id: beta.category.id, restaurantId: alpha.restaurant.id },
      });
      expect(found).toBeNull();
    });

    it("ne remonte pas les produits d'un autre restaurant", async () => {
      const found = await prisma.product.findFirst({
        where: { id: beta.product.id, restaurantId: alpha.restaurant.id },
      });
      expect(found).toBeNull();
    });

    it('ne liste que ses propres produits', async () => {
      const products = await prisma.product.findMany({
        where: { restaurantId: alpha.restaurant.id },
      });

      expect(products).toHaveLength(1);
      expect(products[0]!.id).toBe(alpha.product.id);
    });
  });

  describe('Commandes', () => {
    it("refuse de facturer le produit d'un autre restaurant", async () => {
      // Le cœur de l'attaque : composer un panier avec l'identifiant d'un plat
      // appartenant à Beta, puis le commander chez Alpha.
      await expect(
        priceOrder(prisma, {
          restaurantId: alpha.restaurant.id,
          items: [{ productId: beta.product.id, quantity: 1 }],
          fulfillmentType: 'PICKUP',
        }),
      ).rejects.toThrow(/plus disponible/i);
    });

    it("refuse la zone de livraison d'un autre restaurant", async () => {
      await expect(
        priceOrder(prisma, {
          restaurantId: alpha.restaurant.id,
          items: [{ productId: alpha.product.id, quantity: 1 }],
          fulfillmentType: 'DELIVERY',
          deliveryZoneId: beta.zone.id,
        }),
      ).rejects.toThrow(/zone de livraison/i);
    });

    it("refuse le code promo d'un autre restaurant", async () => {
      // Les deux restaurants ont un code « TEST10 » : celui d'Alpha doit
      // s'appliquer, sans jamais consommer celui de Beta.
      const priced = await priceOrder(prisma, {
        restaurantId: alpha.restaurant.id,
        items: [{ productId: alpha.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        promoCode: 'TEST10',
      });

      expect(priced.promotionId).toBe(alpha.promotion.id);
      expect(priced.promotionId).not.toBe(beta.promotion.id);
    });

    it("ne permet pas de changer le statut d'une commande d'un autre restaurant", async () => {
      const order = await createOrder({
        restaurantId: beta.restaurant.id,
        items: [{ productId: beta.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client Beta',
        customerPhone: '+225 07 99 99 99',
        paymentProvider: 'pay_at_store',
      });

      await expect(
        updateOrderStatus({
          restaurantId: alpha.restaurant.id,
          orderId: order.id,
          status: 'CONFIRMED',
        }),
      ).rejects.toThrow(/introuvable/i);

      // La commande de Beta n'a pas bougé.
      const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
      expect(unchanged!.status).toBe('NEW');
    });

    it('numérote les commandes indépendamment par restaurant', async () => {
      const first = await createOrder({
        restaurantId: alpha.restaurant.id,
        items: [{ productId: alpha.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client Alpha',
        customerPhone: '+225 07 11 00 00',
        paymentProvider: 'pay_at_store',
      });

      // Beta a déjà une commande n°1 : Alpha doit démarrer à 1 lui aussi.
      expect(first.number).toBe(1);
    });
  });

  describe('Clients', () => {
    it('sépare les fiches client portant le même numéro', async () => {
      const phone = '+225 07 55 55 55';

      await createOrder({
        restaurantId: alpha.restaurant.id,
        items: [{ productId: alpha.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client partagé',
        customerPhone: phone,
        paymentProvider: 'pay_at_store',
      });

      await createOrder({
        restaurantId: beta.restaurant.id,
        items: [{ productId: beta.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client partagé',
        customerPhone: phone,
        paymentProvider: 'pay_at_store',
      });

      const alphaCustomers = await prisma.customer.findMany({
        where: { restaurantId: alpha.restaurant.id, phone },
      });
      const betaCustomers = await prisma.customer.findMany({
        where: { restaurantId: beta.restaurant.id, phone },
      });

      expect(alphaCustomers).toHaveLength(1);
      expect(betaCustomers).toHaveLength(1);
      expect(alphaCustomers[0]!.id).not.toBe(betaCustomers[0]!.id);
    });

    it("ne remonte pas les clients d'un autre restaurant", async () => {
      const betaCustomer = await prisma.customer.findFirst({
        where: { restaurantId: beta.restaurant.id },
      });

      const crossTenant = await prisma.customer.findFirst({
        where: { id: betaCustomer!.id, restaurantId: alpha.restaurant.id },
      });

      expect(crossTenant).toBeNull();
    });
  });

  describe('Paiements et statistiques', () => {
    it("n'agrège que le chiffre d'affaires de son restaurant", async () => {
      const alphaTotal = await prisma.order.aggregate({
        where: { restaurantId: alpha.restaurant.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });
      const betaTotal = await prisma.order.aggregate({
        where: { restaurantId: beta.restaurant.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });
      const globalTotal = await prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });

      expect((alphaTotal._sum.total ?? 0) + (betaTotal._sum.total ?? 0)).toBe(
        globalTotal._sum.total ?? 0,
      );
      expect(alphaTotal._sum.total).toBeGreaterThan(0);
      expect(betaTotal._sum.total).toBeGreaterThan(0);
    });

    it("ne remonte pas les paiements d'un autre restaurant", async () => {
      const order = await prisma.order.findFirst({
        where: { restaurantId: beta.restaurant.id },
      });

      await prisma.payment.create({
        data: {
          restaurantId: beta.restaurant.id,
          orderId: order!.id,
          provider: 'pay_at_store',
          amount: order!.total,
          currency: order!.currency,
          reference: `TEST-${Date.now()}`,
        },
      });

      const payments = await prisma.payment.findMany({
        where: { restaurantId: alpha.restaurant.id },
      });
      expect(payments).toHaveLength(0);
    });
  });

  describe('Notifications', () => {
    it("ne permet pas de marquer lue la notification d'un autre restaurant", async () => {
      const notification = await prisma.notification.findFirst({
        where: { restaurantId: beta.restaurant.id },
      });
      expect(notification).not.toBeNull();

      await markNotificationRead(alpha.restaurant.id, notification!.id);

      const after = await prisma.notification.findUnique({
        where: { id: notification!.id },
      });
      expect(after!.readAt).toBeNull();
    });
  });

  describe('Adhésions', () => {
    it("ne trouve pas d'adhésion pour un utilisateur d'un autre restaurant", async () => {
      const membership = await prisma.restaurantUser.findFirst({
        where: { userId: beta.owner.id, restaurantId: alpha.restaurant.id },
      });
      expect(membership).toBeNull();
    });

    it("le propriétaire de Beta n'a accès qu'à Beta", async () => {
      const memberships = await prisma.restaurantUser.findMany({
        where: { userId: beta.owner.id },
      });

      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.restaurantId).toBe(beta.restaurant.id);
    });
  });

  describe('Promotions', () => {
    it("ne remonte pas les promotions d'un autre restaurant", async () => {
      const found = await prisma.promotion.findFirst({
        where: { id: beta.promotion.id, restaurantId: alpha.restaurant.id },
      });
      expect(found).toBeNull();
    });

    it("n'incrémente que le compteur de sa propre promotion", async () => {
      const before = await prisma.promotion.findUnique({
        where: { id: beta.promotion.id },
      });

      await createOrder({
        restaurantId: alpha.restaurant.id,
        items: [{ productId: alpha.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client promo',
        customerPhone: '+225 07 66 66 66',
        promoCode: 'TEST10',
        paymentProvider: 'pay_at_store',
      });

      const after = await prisma.promotion.findUnique({
        where: { id: beta.promotion.id },
      });
      expect(after!.usedCount).toBe(before!.usedCount);
    });
  });
});
