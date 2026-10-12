import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { hashPassword } from '@/lib/auth/password';
import { isAllowedPushEndpoint, pushRecipients, sendPushToUsers } from '@/lib/push';

/**
 * Notifications push.
 *
 * Deux choses à garantir : le serveur n'appelle jamais une adresse qui n'est
 * pas celle d'un service de push officiel, et une alerte ne réveille que les
 * personnes qui ont le droit d'agir dessus.
 */

describe('Adresses des services de push', () => {
  it('accepte les services des navigateurs', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
  });

  it('refuse toute autre adresse, qui ferait appeler par le serveur une machine choisie', () => {
    expect(isAllowedPushEndpoint('https://attaquant.example/push')).toBe(false);
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.attaquant.example/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedPushEndpoint('pas une adresse')).toBe(false);
  });
});

async function member(restaurantId: string, role: 'KITCHEN' | 'COURIER' | 'COUNTER' | 'EMPLOYEE') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.magyapro`,
      name: role,
      passwordHash: await hashPassword('MotDePasse!2345'),
    },
  });
  await prisma.restaurantUser.create({ data: { restaurantId, userId: user.id, role } });
  return user;
}

describe('Destinataires d’une alerte', () => {
  let shop: TestRestaurant;
  let kitchen: { id: string };
  let courier: { id: string };
  let employee: { id: string };

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant();
    kitchen = await member(shop.restaurant.id, 'KITCHEN');
    courier = await member(shop.restaurant.id, 'COURIER');
    employee = await member(shop.restaurant.id, 'EMPLOYEE');
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('réveille pour une commande ceux qui la voient ou la préparent, pas le livreur', async () => {
    const result = await pushRecipients({
      restaurantId: shop.restaurant.id,
      type: 'ORDER_CREATED',
      title: 'Nouvelle commande',
      body: '',
    });
    expect(result?.urgent).toBe(true);
    expect(result?.userIds).toEqual(expect.arrayContaining([shop.owner.id, kitchen.id, employee.id]));
    expect(result?.userIds).not.toContain(courier.id);
  });

  it('ne réveille pas la cuisine pour une réservation', async () => {
    const result = await pushRecipients({
      restaurantId: shop.restaurant.id,
      type: 'RESERVATION_CREATED',
      title: 'Réservation',
      body: '',
    });
    expect(result?.userIds).toEqual(expect.arrayContaining([shop.owner.id, employee.id]));
    expect(result?.userIds).not.toContain(kitchen.id);
  });

  it('n’envoie rien pour ce que l’équipe a elle-même provoqué', async () => {
    for (const type of ['ORDER_STATUS_CHANGED', 'SETTINGS_CHANGED'] as const) {
      expect(
        await pushRecipients({ restaurantId: shop.restaurant.id, type, title: '', body: '' }),
      ).toBeNull();
    }
  });

  it('ne vise qu’une personne quand la notification lui est adressée', async () => {
    const result = await pushRecipients({
      restaurantId: shop.restaurant.id,
      userId: employee.id,
      type: 'ORDER_CREATED',
      title: '',
      body: '',
    });
    expect(result?.userIds).toEqual([employee.id]);
  });

  it('ne fait rien pour un utilisateur sans appareil abonné', async () => {
    await expect(
      sendPushToUsers([shop.owner.id], { title: 'Essai', body: '', url: '/dashboard' }),
    ).resolves.toBe(0);
  });
});
