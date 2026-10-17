import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestRestaurant, createTestStore, resetDatabase } from './helpers';
import { claimCustomDomain } from '@/lib/domain-claims';
import { domainVerificationToken } from '@/lib/domains';
import { createReservationAccess, reservationAccessWhere } from '@/lib/reservations';
import { uploadImage } from '@/lib/storage';
import { canReadPrivateFile, getPrivate, privateKeyOwner } from '@/lib/storage/private';

/**
 * Trois accès qui ne doivent appartenir qu'à leur ayant droit : un domaine
 * personnalisé, une preuve de paiement, le lien de suivi d'une réservation.
 */

// PNG minimal valide (1×1) : la signature binaire est contrôlée à l'envoi.
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  ),
);

describe('Données privées', () => {
  let a: Awaited<ReturnType<typeof createTestRestaurant>>;
  let b: Awaited<ReturnType<typeof createTestRestaurant>>;

  beforeAll(async () => {
    await resetDatabase();
    a = await createTestRestaurant({ name: 'Le vrai propriétaire' });
    b = await createTestRestaurant({ name: 'Le squatteur' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('domaine personnalisé', () => {
    it('donne toujours la même valeur TXT au même restaurant, une autre à un autre', () => {
      const first = domainVerificationToken(a.restaurant.id, 'chez-moi.sn');
      expect(domainVerificationToken(a.restaurant.id, 'chez-moi.sn')).toBe(first);
      expect(domainVerificationToken(b.restaurant.id, 'chez-moi.sn')).not.toBe(first);
    });

    it("une revendication en attente ne bloque plus le vrai propriétaire", async () => {
      const actor = (r: typeof a) => ({ id: r.owner.id, email: r.owner.email });
      // Le squatteur revendique le domaine sans pouvoir le vérifier…
      await claimCustomDomain({ restaurantId: b.restaurant.id, hostname: 'chez-moi.sn', actor: actor(b) });
      // …le vrai propriétaire l'ajoute quand même, avec sa valeur TXT stable.
      const domain = await claimCustomDomain({ restaurantId: a.restaurant.id, hostname: 'chez-moi.sn', actor: actor(a) });
      expect(domain.restaurantId).toBe(a.restaurant.id);
      expect(domain.verificationToken).toBe(domainVerificationToken(a.restaurant.id, 'chez-moi.sn'));
    });

    it('un domaine vérifié reste à son restaurant', async () => {
      await prisma.domain.update({ where: { hostname: 'chez-moi.sn' }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
      await expect(
        claimCustomDomain({
          restaurantId: b.restaurant.id,
          hostname: 'chez-moi.sn',
          actor: { id: b.owner.id, email: b.owner.email },
        }),
      ).rejects.toThrow('déjà relié à un autre restaurant');
    });
  });

  describe('preuves de paiement', () => {
    it("rejette toute clé qui n'est pas une preuve rangée sous un commerce", () => {
      expect(privateKeyOwner('resto1/subscription-proofs/abc.png')).toBe('resto1');
      expect(privateKeyOwner('resto1/logos/abc.png')).toBeNull();
      expect(privateKeyOwner('resto1/payment-proofs/../../etc.png')).toBeNull();
      expect(privateKeyOwner('resto1/payment-proofs/x.svg')).toBeNull();
    });

    it("range une preuve hors de l'espace public, lisible par son commerce et par l'équipe seulement", async () => {
      const stored = await uploadImage({
        file: new File([PNG], 'preuve.png', { type: 'image/png' }),
        restaurantId: a.restaurant.id,
        folder: 'subscription-proofs',
      });
      expect(stored.url.startsWith('/api/fichiers-prives/')).toBe(true);
      expect((await getPrivate(stored.key))?.contentType).toBe('image/png');

      expect(await canReadPrivateFile({ id: a.owner.id, platformRole: 'USER' }, stored.key)).toBe(true);
      expect(await canReadPrivateFile({ id: b.owner.id, platformRole: 'USER' }, stored.key)).toBe(false);
      expect(await canReadPrivateFile({ id: 'equipe', platformRole: 'SUPER_ADMIN' }, stored.key)).toBe(true);
    });

    it('vaut aussi pour une boutique', async () => {
      const shop = await createTestStore();
      const stored = await uploadImage({
        file: new File([PNG], 'preuve.png', { type: 'image/png' }),
        restaurantId: shop.store.id,
        folder: 'subscription-proofs',
      });
      expect(await canReadPrivateFile({ id: shop.owner.id, platformRole: 'USER' }, stored.key)).toBe(true);
      expect(await canReadPrivateFile({ id: a.owner.id, platformRole: 'USER' }, stored.key)).toBe(false);
    });
  });

  describe('lien de suivi de réservation', () => {
    const reservation = (extra: { accessTokenHash?: string | null } = {}) =>
      prisma.reservation.create({
        data: {
          restaurantId: a.restaurant.id,
          customerName: 'Awa',
          customerPhone: '+221770000000',
          partySize: 2,
          reservedFor: new Date(Date.now() + 86_400_000),
          confirmationCode: String(Math.floor(100_000 + Math.random() * 899_999)),
          ...extra,
        },
      });

    it("une nouvelle réservation n'est joignable que par sa clé, pas par son identifiant", async () => {
      const access = createReservationAccess();
      const created = await reservation({ accessTokenHash: access.hash });
      expect(await prisma.reservation.findFirst({ where: reservationAccessWhere(access.key) })).toMatchObject({
        id: created.id,
      });
      expect(await prisma.reservation.findFirst({ where: reservationAccessWhere(created.id) })).toBeNull();
      // La clé n'est jamais stockée en clair.
      expect(created.accessTokenHash).not.toBe(access.key);
    });

    it('une réservation antérieure reste joignable par son identifiant', async () => {
      const legacy = await reservation();
      expect(await prisma.reservation.findFirst({ where: reservationAccessWhere(legacy.id) })).toMatchObject({
        id: legacy.id,
      });
    });
  });
});
