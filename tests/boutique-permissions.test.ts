import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, addStoreMember, createTestStore, resetDatabase, type TestStore } from './helpers';
import { effectiveStorePermissions, permissionsForStoreRole, STORE_PERMISSIONS } from '@/lib/boutique/rbac';
import {
  STORE_FEATURES,
  getStoreEntitlements,
  hasStoreFeature,
  requireStoreFeature,
  requireStoreWithinLimit,
} from '@/lib/boutique/entitlements';

describe('Permissions par rôle (Boutique)', () => {
  it('accorde toutes les permissions au propriétaire', () => {
    const owner = permissionsForStoreRole('OWNER');
    expect(owner).toHaveLength(STORE_PERMISSIONS.length);
  });

  it('limite le caissier aux gestes de la caisse', () => {
    const cashier = new Set(permissionsForStoreRole('CASHIER'));

    expect(cashier.has('pos:access')).toBe(true);
    expect(cashier.has('sales:view')).toBe(true);
    expect(cashier.has('products:view')).toBe(true);

    // Ce qu'il ne doit pas pouvoir faire : gérer le catalogue, les employés,
    // les finances ou l'abonnement.
    expect(cashier.has('products:manage')).toBe(false);
    expect(cashier.has('employees:manage')).toBe(false);
    expect(cashier.has('finances:view')).toBe(false);
    expect(cashier.has('subscription:manage')).toBe(false);
    expect(cashier.has('store:delete')).toBe(false);
    expect(cashier.has('api:manage')).toBe(false);
  });

  it("n'accorde pas à l'administrateur la suppression de la boutique", () => {
    const admin = new Set(permissionsForStoreRole('ADMIN'));

    expect(admin.has('products:manage')).toBe(true);
    expect(admin.has('settings:manage')).toBe(true);
    expect(admin.has('api:manage')).toBe(true);
    // Supprimer la boutique reste au seul propriétaire.
    expect(admin.has('store:delete')).toBe(false);
  });

  it('ajoute les permissions accordées individuellement', () => {
    const permissions = effectiveStorePermissions('CASHIER', ['finances:view']);

    expect(permissions.has('finances:view')).toBe(true);
    expect(permissions.has('pos:access')).toBe(true);
    expect(permissions.has('products:manage')).toBe(false);
  });

  it('ignore une permission inventée', () => {
    const permissions = effectiveStorePermissions('CASHIER', ['tout:permettre', 'store:delete__']);

    expect(permissions.has('store:delete')).toBe(false);
    expect(permissions.size).toBe(permissionsForStoreRole('CASHIER').length);
  });
});

describe('Adhésions et rôles en base (Boutique)', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stocke les permissions supplémentaires du membre', async () => {
    const { membership } = await addStoreMember(shop.store.id, 'CASHIER', ['finances:view']);

    const stored = await prisma.storeUser.findUnique({ where: { id: membership.id } });
    expect(stored!.role).toBe('CASHIER');
    expect(stored!.extraPermissions).toEqual(['finances:view']);

    const permissions = effectiveStorePermissions(stored!.role, stored!.extraPermissions);
    expect(permissions.has('finances:view')).toBe(true);
  });

  it('interdit deux adhésions du même utilisateur à la même boutique', async () => {
    const { user } = await addStoreMember(shop.store.id, 'MANAGER');

    await expect(
      prisma.storeUser.create({
        data: { storeId: shop.store.id, userId: user.id, role: 'CASHIER' },
      }),
    ).rejects.toThrow();
  });
});

describe('Droits liés au plan (Boutique)', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('refuse toute option payante sans abonnement', async () => {
    const entitlements = await getStoreEntitlements(shop.store.id);

    expect(entitlements.isActive).toBe(false);
    expect(hasStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN)).toBe(false);
    expect(() => requireStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN)).toThrow(
      /abonnement/i,
    );
  });

  it('accorde les options du plan souscrit', async () => {
    const plan = await prisma.plan.create({
      data: {
        key: `test-boutique-premium-${Date.now()}`,
        name: 'Test Boutique Premium',
        product: 'STORE',
        price: 15_000,
        currency: 'XOF',
        features: [STORE_FEATURES.MULTIPLE_USERS, STORE_FEATURES.CUSTOM_DOMAIN],
        limits: { maxProducts: 2 },
      },
    });

    await prisma.storeSubscription.create({
      data: {
        storeId: shop.store.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const entitlements = await getStoreEntitlements(shop.store.id);

    expect(entitlements.isActive).toBe(true);
    expect(hasStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN)).toBe(true);
  });

  it('applique les limites quantitatives du plan', async () => {
    // La boutique de test a déjà un produit ; la limite est de 2.
    await expect(requireStoreWithinLimit(shop.store.id, 'maxProducts')).resolves.toBeUndefined();

    await prisma.storeProduct.create({
      data: {
        storeId: shop.store.id,
        categoryId: shop.category.id,
        name: 'Deuxième produit',
        status: 'ACTIVE',
      },
    });

    await expect(requireStoreWithinLimit(shop.store.id, 'maxProducts')).rejects.toThrow(
      /limité à 2/i,
    );
  });

  it("considère inactif un abonnement dont la période est écoulée", async () => {
    await prisma.storeSubscription.update({
      where: { storeId: shop.store.id },
      data: { currentPeriodEnd: new Date(Date.now() - 86_400_000) },
    });

    const entitlements = await getStoreEntitlements(shop.store.id);

    expect(entitlements.isActive).toBe(false);
    expect(hasStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN)).toBe(false);
  });
});
