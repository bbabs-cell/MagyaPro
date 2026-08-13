import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, addMember, createTestRestaurant, resetDatabase, type TestRestaurant } from './helpers';
import { effectivePermissions, permissionsForRole, PERMISSIONS } from '@/lib/rbac';
import {
  FEATURES,
  getEntitlements,
  hasFeature,
  requireFeature,
  requireWithinLimit,
} from '@/lib/entitlements';

describe('Permissions par rôle', () => {
  it('accorde toutes les permissions au propriétaire', () => {
    const owner = permissionsForRole('OWNER');
    expect(owner).toHaveLength(PERMISSIONS.length);
  });

  it("limite l'employé aux gestes du service", () => {
    const employee = new Set(permissionsForRole('EMPLOYEE'));

    // Ce qu'il doit pouvoir faire : consulter le menu, traiter les commandes.
    expect(employee.has('orders:view')).toBe(true);
    expect(employee.has('orders:update_status')).toBe(true);
    expect(employee.has('menu:view')).toBe(true);

    // Ce qu'il ne doit pas pouvoir faire : toucher au menu, aux revenus,
    // à l'équipe ou à l'abonnement.
    expect(employee.has('menu:manage')).toBe(false);
    expect(employee.has('analytics:view')).toBe(false);
    expect(employee.has('team:manage')).toBe(false);
    expect(employee.has('subscription:manage')).toBe(false);
    expect(employee.has('restaurant:delete')).toBe(false);
    expect(employee.has('orders:cancel')).toBe(false);
  });

  it("n'accorde pas à l'administrateur la suppression du restaurant", () => {
    const admin = new Set(permissionsForRole('ADMIN'));

    expect(admin.has('menu:manage')).toBe(true);
    expect(admin.has('analytics:view')).toBe(true);
    // Supprimer le restaurant reste au seul propriétaire.
    expect(admin.has('restaurant:delete')).toBe(false);
    expect(admin.has('team:manage')).toBe(false);
    expect(admin.has('subscription:manage')).toBe(false);
  });

  it('ajoute les permissions accordées individuellement', () => {
    const permissions = effectivePermissions('EMPLOYEE', ['analytics:view']);

    expect(permissions.has('analytics:view')).toBe(true);
    expect(permissions.has('orders:view')).toBe(true);
    // Les autres restent fermées.
    expect(permissions.has('menu:manage')).toBe(false);
  });

  it('ignore une permission inventée', () => {
    const permissions = effectivePermissions('EMPLOYEE', [
      'tout:permettre',
      'restaurant:delete__',
    ]);

    expect(permissions.has('restaurant:delete')).toBe(false);
    expect(permissions.size).toBe(permissionsForRole('EMPLOYEE').length);
  });
});

describe('Adhésions et rôles en base', () => {
  let shop: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stocke les permissions supplémentaires du membre', async () => {
    const { membership } = await addMember(shop.restaurant.id, 'EMPLOYEE', [
      'analytics:view',
    ]);

    const stored = await prisma.restaurantUser.findUnique({
      where: { id: membership.id },
    });

    expect(stored!.role).toBe('EMPLOYEE');
    expect(stored!.extraPermissions).toEqual(['analytics:view']);

    const permissions = effectivePermissions(stored!.role, stored!.extraPermissions);
    expect(permissions.has('analytics:view')).toBe(true);
  });

  it('interdit deux adhésions du même utilisateur au même restaurant', async () => {
    const { user } = await addMember(shop.restaurant.id, 'ADMIN');

    await expect(
      prisma.restaurantUser.create({
        data: {
          restaurantId: shop.restaurant.id,
          userId: user.id,
          role: 'EMPLOYEE',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Droits liés au plan', () => {
  let shop: TestRestaurant;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestRestaurant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refuse toute option payante sans abonnement", async () => {
    const entitlements = await getEntitlements(shop.restaurant.id);

    expect(entitlements.isActive).toBe(false);
    expect(hasFeature(entitlements, FEATURES.PROMOTIONS)).toBe(false);
    expect(() => requireFeature(entitlements, FEATURES.PROMOTIONS)).toThrow(
      /abonnement/i,
    );
  });

  it('accorde les options du plan souscrit', async () => {
    const plan = await prisma.plan.create({
      data: {
        key: `test-pro-${Date.now()}`,
        name: 'Test Pro',
        price: 10_000,
        currency: 'XOF',
        features: [FEATURES.PROMOTIONS, FEATURES.ADVANCED_ANALYTICS],
        limits: { maxProducts: 2 },
      },
    });

    await prisma.subscription.create({
      data: {
        restaurantId: shop.restaurant.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const entitlements = await getEntitlements(shop.restaurant.id);

    expect(entitlements.isActive).toBe(true);
    expect(hasFeature(entitlements, FEATURES.PROMOTIONS)).toBe(true);
    // Une option absente du plan reste fermée.
    expect(hasFeature(entitlements, FEATURES.CUSTOM_DOMAIN)).toBe(false);
    expect(() => requireFeature(entitlements, FEATURES.CUSTOM_DOMAIN)).toThrow(
      /n'est pas incluse/i,
    );
  });

  it('applique les limites quantitatives du plan', async () => {
    // Le restaurant de test a déjà un produit ; la limite est de 2.
    await expect(
      requireWithinLimit(shop.restaurant.id, 'maxProducts'),
    ).resolves.toBeUndefined();

    await prisma.product.create({
      data: {
        restaurantId: shop.restaurant.id,
        categoryId: shop.category.id,
        name: 'Deuxième plat',
        slug: 'deuxieme-plat',
        price: 3000,
      },
    });

    await expect(requireWithinLimit(shop.restaurant.id, 'maxProducts')).rejects.toThrow(
      /limité à 2/i,
    );
  });

  it("considère inactif un abonnement dont la période est écoulée", async () => {
    await prisma.subscription.update({
      where: { restaurantId: shop.restaurant.id },
      data: { currentPeriodEnd: new Date(Date.now() - 86_400_000) },
    });

    const entitlements = await getEntitlements(shop.restaurant.id);

    // Le statut en base dit encore ACTIVE, mais la période est passée : les
    // droits doivent tomber sans attendre une tâche de facturation.
    expect(entitlements.isActive).toBe(false);
    expect(entitlements.status).toBe('EXPIRED');
    expect(hasFeature(entitlements, FEATURES.PROMOTIONS)).toBe(false);
  });
});
