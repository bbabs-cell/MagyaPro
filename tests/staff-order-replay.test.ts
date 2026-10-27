import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { createStaffOrder } from '@/lib/orders/staff-order';

/**
 * Une commande prise au comptoir hors connexion, renvoyée, ne doit pas être
 * créée deux fois.
 *
 * Le cas réel : la commande attend sur l'appareil pendant une coupure, part
 * au retour du réseau, et la réponse se perd sur une connexion instable —
 * l'écran la renvoie. Sans identifiant de requête, le serveur la créait une
 * seconde fois : deux bons en cuisine pour un seul client.
 */
describe('Commande au comptoir — renvoi après une réponse perdue', () => {
  let resto: TestRestaurant;

  const take = (clientRequestId?: string) =>
    createStaffOrder({
      restaurantId: resto.restaurant.id,
      userId: resto.owner.id,
      userEmail: resto.owner.email,
      input: {
        items: [{ productId: resto.product.id, quantity: 2 }],
        fulfillmentType: 'PICKUP',
        customerName: 'Client du comptoir',
        alreadyPaid: false,
        clientRequestId,
      } as never,
    });

  const orderCounter = async () =>
    (await prisma.restaurant.findUniqueOrThrow({ where: { id: resto.restaurant.id } })).orderCounter;

  beforeAll(async () => {
    await resetDatabase();
    resto = await createTestRestaurant({ productPrice: 5000 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rend la commande déjà créée, sans la refaire', async () => {
    const id = randomUUID();
    const first = await take(id);
    const replay = await take(id);

    expect(replay.id).toBe(first.id);
    expect(replay.number).toBe(first.number);
    expect(await prisma.order.count({ where: { restaurantId: resto.restaurant.id, clientRequestId: id } })).toBe(1);
    // Elle est bien partie en cuisine, confirmée.
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.status).toBe('CONFIRMED');
  });

  it('rend la commande même si le plat a été retiré entre-temps', async () => {
    // Entre l'envoi et le renvoi, le plat a pu être marqué épuisé : la
    // commande a pourtant bien été prise. La revalider la ferait refuser, et
    // l'écran la croirait perdue.
    const id = randomUUID();
    const first = await take(id);
    await prisma.product.update({ where: { id: resto.product.id }, data: { isAvailable: false } });
    try {
      const replay = await take(id);
      expect(replay.id).toBe(first.id);
    } finally {
      await prisma.product.update({ where: { id: resto.product.id }, data: { isAvailable: true } });
    }
  });

  it('dédoublonne deux renvois simultanés', async () => {
    const id = randomUUID();
    const before = await orderCounter();

    const [a, b] = await Promise.all([take(id), take(id)]);

    expect(a.id).toBe(b.id);
    expect(await prisma.order.count({ where: { restaurantId: resto.restaurant.id, clientRequestId: id } })).toBe(1);
    // La transaction perdante est annulée en entier : pas de numéro sauté.
    expect(await orderCounter()).toBe(before + 1);
  });

  it('laisse les commandes sans identifiant se comporter comme avant', async () => {
    const a = await take();
    const b = await take();
    expect(a.id).not.toBe(b.id);
  });
});
