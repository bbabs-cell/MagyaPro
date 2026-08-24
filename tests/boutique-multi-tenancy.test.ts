import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { createSale } from '@/lib/boutique/sales-service';

/**
 * Isolation multi-tenant Boutique — la suite critique, même principe que
 * `multi-tenancy.test.ts` (Restaurant). Vérifie qu'une boutique A ne peut
 * atteindre aucune donnée d'une boutique B, sur chaque famille d'entités.
 */
describe('Isolation multi-tenant (Boutique)', () => {
  let alpha: TestStore;
  let beta: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    alpha = await createTestStore({ name: 'Boutique Alpha' });
    beta = await createTestStore({ name: 'Boutique Beta' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Catalogue', () => {
    it("ne remonte pas les produits d'une autre boutique", async () => {
      const found = await prisma.storeProduct.findFirst({
        where: { id: beta.product.id, storeId: alpha.store.id },
      });
      expect(found).toBeNull();
    });

    it('ne liste que ses propres produits', async () => {
      const products = await prisma.storeProduct.findMany({
        where: { storeId: alpha.store.id },
      });
      expect(products).toHaveLength(1);
      expect(products[0]!.id).toBe(alpha.product.id);
    });
  });

  describe('Ventes', () => {
    it("refuse de facturer la variante d'une autre boutique", async () => {
      // Le cœur de l'attaque : composer un panier avec l'identifiant d'une
      // variante appartenant à Beta, puis vendre chez Alpha.
      await expect(
        createSale({
          storeId: alpha.store.id,
          userId: alpha.owner.id,
          userEmail: alpha.owner.email,
          input: {
            items: [{ productVariantId: beta.variant.id, quantity: 1 }],
            payments: [{ method: 'cash', amount: 5000 }],
            discount: 0,
          },
        }),
      ).rejects.toThrow(/introuvable/i);
    });

    it("refuse le code promo d'une autre boutique", async () => {
      const sale = await createSale({
        storeId: alpha.store.id,
        userId: alpha.owner.id,
        userEmail: alpha.owner.email,
        input: {
          items: [{ productVariantId: alpha.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 4500 }],
          discount: 0,
          promoCode: 'TEST10',
        },
      });

      expect(sale.promotionId).toBe(alpha.promotion.id);
      expect(sale.promotionId).not.toBe(beta.promotion.id);
    });

    it("n'incrémente que le compteur de son propre code promo", async () => {
      const before = await prisma.storePromotion.findUnique({ where: { id: beta.promotion.id } });

      await createSale({
        storeId: alpha.store.id,
        userId: alpha.owner.id,
        userEmail: alpha.owner.email,
        input: {
          items: [{ productVariantId: alpha.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 4500 }],
          discount: 0,
          promoCode: 'TEST10',
        },
      });

      const after = await prisma.storePromotion.findUnique({ where: { id: beta.promotion.id } });
      expect(after!.usedCount).toBe(before!.usedCount);
    });

    it('numérote les ventes indépendamment par boutique', async () => {
      const first = await createSale({
        storeId: beta.store.id,
        userId: beta.owner.id,
        userEmail: beta.owner.email,
        input: {
          items: [{ productVariantId: beta.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 5000 }],
          discount: 0,
        },
      });

      // Alpha a déjà vendu deux fois dans les tests précédents ; Beta doit
      // démarrer sa propre numérotation à 1.
      expect(first.number).toBe(1);
    });

    it("ne décrémente pas le stock d'une autre boutique", async () => {
      const betaInventoryBefore = await prisma.inventory.findFirst({
        where: { productVariantId: beta.variant.id },
      });

      await createSale({
        storeId: alpha.store.id,
        userId: alpha.owner.id,
        userEmail: alpha.owner.email,
        input: {
          items: [{ productVariantId: alpha.variant.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 4500 }],
          discount: 0,
        },
      });

      const betaInventoryAfter = await prisma.inventory.findFirst({
        where: { productVariantId: beta.variant.id },
      });
      expect(Number(betaInventoryAfter!.quantity)).toBe(Number(betaInventoryBefore!.quantity));
    });
  });

  describe('Clients et crédits', () => {
    it("refuse le client d'une autre boutique pour une vente à crédit", async () => {
      const betaCustomer = await prisma.storeCustomer.create({
        data: { storeId: beta.store.id, name: 'Client Beta', phone: '+225 07 00 00 01' },
      });

      await expect(
        createSale({
          storeId: alpha.store.id,
          userId: alpha.owner.id,
          userEmail: alpha.owner.email,
          input: {
            items: [{ productVariantId: alpha.variant.id, quantity: 1 }],
            payments: [],
            discount: 0,
            customerId: betaCustomer.id,
          },
        }),
      ).rejects.toThrow(/introuvable/i);
    });

    it("ne remonte pas les clients d'une autre boutique", async () => {
      const betaCustomer = await prisma.storeCustomer.findFirst({
        where: { storeId: beta.store.id },
      });
      const crossTenant = await prisma.storeCustomer.findFirst({
        where: { id: betaCustomer!.id, storeId: alpha.store.id },
      });
      expect(crossTenant).toBeNull();
    });
  });

  describe('Finances', () => {
    it("n'agrège que le chiffre d'affaires de sa propre boutique", async () => {
      const alphaTotal = await prisma.sale.aggregate({
        where: { storeId: alpha.store.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });
      const betaTotal = await prisma.sale.aggregate({
        where: { storeId: beta.store.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });
      const globalTotal = await prisma.sale.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
      });

      expect((alphaTotal._sum.total ?? 0) + (betaTotal._sum.total ?? 0)).toBe(
        globalTotal._sum.total ?? 0,
      );
      expect(alphaTotal._sum.total).toBeGreaterThan(0);
      expect(betaTotal._sum.total).toBeGreaterThan(0);
    });
  });

  describe('Adhésions', () => {
    it("ne trouve pas d'adhésion pour un utilisateur d'une autre boutique", async () => {
      const membership = await prisma.storeUser.findFirst({
        where: { userId: beta.owner.id, storeId: alpha.store.id },
      });
      expect(membership).toBeNull();
    });

    it("le propriétaire de Beta n'a accès qu'à Beta", async () => {
      const memberships = await prisma.storeUser.findMany({ where: { userId: beta.owner.id } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.storeId).toBe(beta.store.id);
    });
  });
});
