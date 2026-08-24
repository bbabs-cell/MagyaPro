import { beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { generateApiKey, requireApiKeyStore } from '@/lib/boutique/api-auth';
import { generateWebhookSecret, sign } from '@/lib/boutique/webhooks';
import { hashToken } from '@/lib/auth/tokens';
import { effectiveStorePermissions } from '@/lib/boutique/rbac';
import { UnauthorizedError } from '@/lib/errors';
import { createTestStore, resetDatabase } from './helpers';

/**
 * Clés d'API publiques et webhooks sortants (`/api/v1/*`,
 * `StoreApiKey`/`StoreWebhook`) — zone sécurité identifiée sans aucune
 * couverture de test lors de l'audit du projet. Couvre : format et
 * empreinte des clés générées, résolution/rejet d'une clé (révoquée,
 * boutique suspendue, absente), isolation entre boutiques, signature HMAC
 * des webhooks, et permission requise (`api:manage`) pour gérer ces deux
 * fonctionnalités.
 */
describe('Clés API et webhooks Boutique', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe('generateApiKey', () => {
    it('génère une clé préfixée dont seule l’empreinte est réutilisable', () => {
      const { key, keyHash, keyPrefix } = generateApiKey();

      expect(key.startsWith('mpk_')).toBe(true);
      expect(keyPrefix).toBe(key.slice(0, 12));
      expect(keyHash).toBe(hashToken(key));
      expect(keyHash).not.toBe(key);
    });

    it('génère une clé différente à chaque appel', () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.key).not.toBe(b.key);
    });
  });

  describe('requireApiKeyStore', () => {
    it('résout la boutique propriétaire pour une clé valide', async () => {
      const { store } = await createTestStore();
      const { key, keyHash, keyPrefix } = generateApiKey();
      await prisma.storeApiKey.create({
        data: { storeId: store.id, name: 'Intégration test', keyHash, keyPrefix },
      });

      const request = new Request('https://example.test/api/v1/produits', {
        headers: { authorization: `Bearer ${key}` },
      });
      const resolved = await requireApiKeyStore(request);

      expect(resolved.id).toBe(store.id);
    });

    it('rejette une clé révoquée', async () => {
      const { store } = await createTestStore();
      const { key, keyHash, keyPrefix } = generateApiKey();
      await prisma.storeApiKey.create({
        data: { storeId: store.id, name: 'Révoquée', keyHash, keyPrefix, revokedAt: new Date() },
      });

      const request = new Request('https://example.test/api/v1/produits', {
        headers: { authorization: `Bearer ${key}` },
      });

      await expect(requireApiKeyStore(request)).rejects.toThrow(UnauthorizedError);
    });

    it('rejette une clé valide dont la boutique est suspendue', async () => {
      const { store } = await createTestStore({ status: 'SUSPENDED' });
      const { key, keyHash, keyPrefix } = generateApiKey();
      await prisma.storeApiKey.create({
        data: { storeId: store.id, name: 'Boutique suspendue', keyHash, keyPrefix },
      });

      const request = new Request('https://example.test/api/v1/produits', {
        headers: { authorization: `Bearer ${key}` },
      });

      await expect(requireApiKeyStore(request)).rejects.toThrow(UnauthorizedError);
    });

    it('rejette une requête sans en-tête Authorization', async () => {
      const request = new Request('https://example.test/api/v1/produits');
      await expect(requireApiKeyStore(request)).rejects.toThrow(UnauthorizedError);
    });

    it('rejette une clé inconnue (jamais créée)', async () => {
      const request = new Request('https://example.test/api/v1/produits', {
        headers: { authorization: 'Bearer mpk_inconnue' },
      });
      await expect(requireApiKeyStore(request)).rejects.toThrow(UnauthorizedError);
    });

    it('isole les clés entre boutiques : la clé de A ne résout jamais B', async () => {
      const { store: storeA } = await createTestStore();
      const { store: storeB } = await createTestStore();
      const { key, keyHash, keyPrefix } = generateApiKey();
      await prisma.storeApiKey.create({
        data: { storeId: storeA.id, name: 'Clé A', keyHash, keyPrefix },
      });

      const request = new Request('https://example.test/api/v1/produits', {
        headers: { authorization: `Bearer ${key}` },
      });
      const resolved = await requireApiKeyStore(request);

      expect(resolved.id).toBe(storeA.id);
      expect(resolved.id).not.toBe(storeB.id);
    });
  });

  describe('Webhooks sortants', () => {
    it('génère un secret préfixé, différent à chaque appel', () => {
      const a = generateWebhookSecret();
      const b = generateWebhookSecret();

      expect(a.startsWith('whsec_')).toBe(true);
      expect(a).not.toBe(b);
    });

    it('produit une signature HMAC-SHA256 déterministe et vérifiable', () => {
      const secret = generateWebhookSecret();
      const body = JSON.stringify({ event: 'SALE_CREATED', data: { id: 'test' } });

      const signature = sign(secret, body);

      expect(signature).toMatch(/^[0-9a-f]{64}$/);
      // Même secret et même corps → même signature (le destinataire doit
      // pouvoir la recalculer à l'identique pour la vérifier).
      expect(sign(secret, body)).toBe(signature);
    });

    it('produit une signature différente pour un secret ou un corps différent', () => {
      const secret = generateWebhookSecret();
      const body = JSON.stringify({ event: 'SALE_CREATED' });

      const signature = sign(secret, body);

      expect(sign(generateWebhookSecret(), body)).not.toBe(signature);
      expect(sign(secret, JSON.stringify({ event: 'ORDER_CREATED' }))).not.toBe(signature);
    });
  });

  describe('Permission api:manage', () => {
    it("n'est accordée qu'aux rôles ADMIN et OWNER", () => {
      expect(effectiveStorePermissions('OWNER', []).has('api:manage')).toBe(true);
      expect(effectiveStorePermissions('ADMIN', []).has('api:manage')).toBe(true);
      expect(effectiveStorePermissions('CASHIER', []).has('api:manage')).toBe(false);
      expect(effectiveStorePermissions('SALESPERSON', []).has('api:manage')).toBe(false);
      expect(effectiveStorePermissions('STOCK_MANAGER', []).has('api:manage')).toBe(false);
      expect(effectiveStorePermissions('ACCOUNTANT', []).has('api:manage')).toBe(false);
    });

    it('peut être accordée ponctuellement via extraPermissions', () => {
      expect(effectiveStorePermissions('CASHIER', ['api:manage']).has('api:manage')).toBe(true);
    });
  });
});
