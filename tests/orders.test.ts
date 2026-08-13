import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { canTransition, createOrder, updateOrderStatus } from '@/lib/orders/service';
import { applyPaymentStatus, initiatePayment } from '@/lib/payments/service';
import { availableProvidersFor, getProvider } from '@/lib/payments/registry';

describe('Cycle de vie des commandes', () => {
  let shop: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant({ productPrice: 4000 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crée une commande avec ses lignes et son instantané client', async () => {
    const order = await createOrder({
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 2 }],
      fulfillmentType: 'DELIVERY',
      deliveryZoneId: shop.zone.id,
      customerName: 'Awa Koné',
      customerPhone: '+225 07 11 22 33',
      deliveryAddress: 'Rue des Jardins',
      paymentProvider: 'cash_on_delivery',
    });

    expect(order.status).toBe('NEW');
    expect(order.subtotal).toBe(8000);
    expect(order.deliveryFee).toBe(1000);
    expect(order.total).toBe(9000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.productName).toBe('Plat test');
    expect(order.items[0]!.unitPrice).toBe(4000);
  });

  it("exige une adresse pour une commande en livraison", async () => {
    await expect(
      createOrder({
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'DELIVERY',
        deliveryZoneId: shop.zone.id,
        customerName: 'Sans adresse',
        customerPhone: '+225 07 00 11 22',
        paymentProvider: 'cash_on_delivery',
      }),
    ).rejects.toThrow(/adresse de livraison/i);
  });

  it('incrémente le numéro de commande à chaque création', async () => {
    const first = await prisma.order.findFirst({
      where: { restaurantId: shop.restaurant.id },
      orderBy: { number: 'desc' },
    });

    const next = await createOrder({
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 1 }],
      fulfillmentType: 'PICKUP',
      customerName: 'Client suivant',
      customerPhone: '+225 07 44 55 66',
      paymentProvider: 'pay_at_store',
    });

    expect(next.number).toBe(first!.number + 1);
  });

  it('met à jour les agrégats du client', async () => {
    const phone = '+225 07 77 88 99';

    await createOrder({
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 1 }],
      fulfillmentType: 'PICKUP',
      customerName: 'Client fidèle',
      customerPhone: phone,
      paymentProvider: 'pay_at_store',
    });

    await createOrder({
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 2 }],
      fulfillmentType: 'PICKUP',
      customerName: 'Client fidèle',
      customerPhone: phone,
      paymentProvider: 'pay_at_store',
    });

    const customer = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: shop.restaurant.id, phone } },
    });

    expect(customer!.ordersCount).toBe(2);
    expect(customer!.totalSpent).toBe(4000 + 8000);
    expect(customer!.lastOrderAt).not.toBeNull();
  });

  it('crée une notification pour le restaurant', async () => {
    const notifications = await prisma.notification.findMany({
      where: { restaurantId: shop.restaurant.id, type: 'ORDER_CREATED' },
    });
    expect(notifications.length).toBeGreaterThan(0);
  });

  describe('Transitions de statut', () => {
    it('autorise la progression normale du service', () => {
      expect(canTransition('NEW', 'CONFIRMED')).toBe(true);
      expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
      expect(canTransition('PREPARING', 'READY')).toBe(true);
      expect(canTransition('READY', 'OUT_FOR_DELIVERY')).toBe(true);
      expect(canTransition('OUT_FOR_DELIVERY', 'COMPLETED')).toBe(true);
    });

    it('interdit de sauter des étapes ou de revenir en arrière', () => {
      expect(canTransition('NEW', 'COMPLETED')).toBe(false);
      expect(canTransition('PREPARING', 'NEW')).toBe(false);
      expect(canTransition('COMPLETED', 'PREPARING')).toBe(false);
      expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    });

    it('applique une transition valide et consigne l\'événement', async () => {
      const order = await createOrder({
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client transition',
        customerPhone: '+225 07 10 10 10',
        paymentProvider: 'pay_at_store',
      });

      await updateOrderStatus({
        restaurantId: shop.restaurant.id,
        orderId: order.id,
        status: 'CONFIRMED',
      });

      const updated = await prisma.order.findUnique({
        where: { id: order.id },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });

      expect(updated!.status).toBe('CONFIRMED');
      expect(updated!.events).toHaveLength(2);
      expect(updated!.events[1]!.fromStatus).toBe('NEW');
      expect(updated!.events[1]!.toStatus).toBe('CONFIRMED');
    });

    it('rejette une transition interdite', async () => {
      const order = await createOrder({
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client saut',
        customerPhone: '+225 07 20 20 20',
        paymentProvider: 'pay_at_store',
      });

      await expect(
        updateOrderStatus({
          restaurantId: shop.restaurant.id,
          orderId: order.id,
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(/ne peut pas passer/i);
    });

    it("retire une commande annulée des agrégats du client", async () => {
      const phone = '+225 07 30 30 30';

      const order = await createOrder({
        restaurantId: shop.restaurant.id,
        items: [{ productId: shop.product.id, quantity: 1 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client annulation',
        customerPhone: phone,
        paymentProvider: 'pay_at_store',
      });

      const before = await prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId: shop.restaurant.id, phone } },
      });
      expect(before!.ordersCount).toBe(1);
      expect(before!.totalSpent).toBe(4000);

      await updateOrderStatus({
        restaurantId: shop.restaurant.id,
        orderId: order.id,
        status: 'CANCELLED',
        note: 'Client injoignable',
      });

      const after = await prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId: shop.restaurant.id, phone } },
      });
      expect(after!.ordersCount).toBe(0);
      expect(after!.totalSpent).toBe(0);

      const cancelled = await prisma.order.findUnique({ where: { id: order.id } });
      expect(cancelled!.cancelReason).toBe('Client injoignable');
      expect(cancelled!.cancelledAt).not.toBeNull();
    });
  });
});

describe('Paiements', () => {
  let shop: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant({ productPrice: 4000 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('ne propose que les fournisseurs réellement opérationnels', () => {
    const providers = availableProvidersFor({
      enabledIds: ['cash_on_delivery', 'pay_at_store', 'orange_money'],
      currency: 'XOF',
    });

    // Orange Money n'est pas configuré sur cette instance : il est écarté
    // plutôt que proposé pour échouer au paiement.
    expect(providers.map((provider) => provider.id)).toEqual([
      'cash_on_delivery',
      'pay_at_store',
    ]);
  });

  it('adapte les moyens de paiement au mode de retrait', () => {
    const delivery = availableProvidersFor({
      enabledIds: ['cash_on_delivery', 'pay_at_store'],
      currency: 'XOF',
      fulfillmentType: 'DELIVERY',
    });
    const pickup = availableProvidersFor({
      enabledIds: ['cash_on_delivery', 'pay_at_store'],
      currency: 'XOF',
      fulfillmentType: 'PICKUP',
    });

    expect(delivery.map((provider) => provider.id)).toEqual(['cash_on_delivery']);
    expect(pickup.map((provider) => provider.id)).toEqual(['pay_at_store']);
  });

  it("signale un fournisseur non configuré plutôt que de simuler un encaissement", async () => {
    const orange = getProvider('orange_money');
    expect(orange).not.toBeNull();
    expect(orange!.isAvailable()).toBe(false);
    await expect(
      orange!.initiate({
        reference: 'X',
        amount: 1000,
        currency: 'XOF',
        orderId: 'x',
        orderNumber: 1,
        restaurantId: 'x',
        restaurantName: 'x',
        customerName: 'x',
        customerPhone: 'x',
        returnUrl: 'https://example.test',
      }),
    ).rejects.toThrow(/n'est pas configuré/i);
  });

  it('laisse un paiement hors ligne en attente jusqu\'à l\'encaissement', async () => {
    const order = await createOrder({
      restaurantId: shop.restaurant.id,
      items: [{ productId: shop.product.id, quantity: 1 }],
      fulfillmentType: 'PICKUP',
      customerName: 'Client comptoir',
      customerPhone: '+225 07 40 40 40',
      paymentProvider: 'pay_at_store',
    });

    const result = await initiatePayment({
      orderId: order.id,
      restaurantId: shop.restaurant.id,
      providerId: 'pay_at_store',
      returnUrl: 'https://example.test/retour',
    });

    // Le paiement n'est pas marqué « payé » : l'argent n'a pas encore changé
    // de mains.
    expect(result.status).toBe('PENDING');
    expect(result.instructions).toBeTruthy();

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored!.paymentStatus).toBe('PENDING');
  });

  it('enregistre l\'encaissement et met la commande à jour', async () => {
    const payment = await prisma.payment.findFirst({
      where: { restaurantId: shop.restaurant.id },
      orderBy: { createdAt: 'desc' },
    });

    await applyPaymentStatus({
      restaurantId: shop.restaurant.id,
      paymentId: payment!.id,
      status: 'PAID',
    });

    const order = await prisma.order.findUnique({ where: { id: payment!.orderId! } });
    expect(order!.paymentStatus).toBe('PAID');
  });

  it('interdit une transition de statut de paiement incohérente', async () => {
    const payment = await prisma.payment.findFirst({
      where: { restaurantId: shop.restaurant.id, status: 'PAID' },
    });

    // Un webhook rejoué ne doit pas ramener un paiement encaissé en attente.
    await expect(
      applyPaymentStatus({
        restaurantId: shop.restaurant.id,
        paymentId: payment!.id,
        status: 'PENDING',
      }),
    ).rejects.toThrow(/ne peut pas passer/i);
  });

  it("refuse d'agir sur le paiement d'un autre restaurant", async () => {
    const other = await createTestRestaurant();
    const payment = await prisma.payment.findFirst({
      where: { restaurantId: shop.restaurant.id },
    });

    await expect(
      applyPaymentStatus({
        restaurantId: other.restaurant.id,
        paymentId: payment!.id,
        status: 'REFUNDED',
      }),
    ).rejects.toThrow(/introuvable/i);
  });
});
