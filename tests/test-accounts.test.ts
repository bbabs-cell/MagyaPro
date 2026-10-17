import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import { setStoreTestAccount } from '@/lib/admin/test-accounts';
import { getPlatformMetrics } from '@/lib/analytics';
import { getPlatformStoreMetrics } from '@/lib/boutique/platform-analytics';
import { getPlatformRevenue } from '@/lib/platform-revenue';

/**
 * Comptes de test et de démonstration : ils fonctionnent normalement, mais ne
 * comptent dans aucun chiffre de la plateforme. Trois boutiques : une vraie,
 * une de test, une de démonstration — chacune avec une vente et un paiement
 * d'abonnement validé.
 */
describe('Comptes exclus des chiffres de la plateforme', () => {
  let real: TestStore;
  let test: TestStore;
  let demo: TestStore;
  let planId: string;
  let admin: { id: string; email: string; ip: null };

  beforeAll(async () => {
    await resetDatabase();
    real = await createTestStore({ name: 'Vraie boutique' });
    test = await createTestStore({ name: 'Boutique d’essai' });
    demo = await createTestStore({ name: 'Boutique démo' });
    await prisma.store.update({ where: { id: demo.store.id }, data: { isDemo: true } });
    await prisma.user.update({ where: { id: demo.owner.id }, data: { isDemo: true } });
    // Un compte de l'équipe MagyaPro et un inscrit sans commerce.
    const staff = await prisma.user.create({
      data: { email: 'equipe@test.magyapro', name: 'Équipe', passwordHash: 'x', platformRole: 'SUPER_ADMIN' },
    });
    admin = { id: staff.id, email: staff.email, ip: null };
    await prisma.user.create({ data: { email: 'inscrit@test.magyapro', name: 'Inscrit', passwordHash: 'x' } });

    const plan = await prisma.plan.create({
      data: { key: 'boutique-test-comptes', name: 'Pro', product: 'STORE', price: 10_000, interval: 'MONTH' },
    });
    planId = plan.id;

    for (const [index, shop] of [real, test, demo].entries()) {
      await prisma.sale.create({
        data: { storeId: shop.store.id, number: 1, subtotal: 5_000 * (index + 1), total: 5_000 * (index + 1) },
      });
      await prisma.storeSubscriptionPayment.create({
        data: {
          storeId: shop.store.id,
          planId,
          provider: 'wave_manual',
          amount: 10_000,
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('marque un compte de test, une seule fois, et le journalise', async () => {
    expect(await setStoreTestAccount({ storeId: test.store.id, isTest: true, actor: admin })).toEqual({ isTest: true });
    // Rejouer ne change rien et n'écrit pas un second événement.
    await setStoreTestAccount({ storeId: test.store.id, isTest: true, actor: admin });
    const logs = await prisma.auditLog.findMany({ where: { targetId: test.store.id, action: 'store.test_marked' } });
    expect(logs).toHaveLength(1);
  });

  it("refuse de marquer une démonstration, déjà exclue", async () => {
    await expect(setStoreTestAccount({ storeId: demo.store.id, isTest: true, actor: admin })).rejects.toThrow(
      'déjà exclue',
    );
  });

  it('ne compte que la vraie boutique dans les statistiques', async () => {
    const metrics = await getPlatformStoreMetrics();
    expect(metrics.stores).toBe(1);
    expect(metrics.sales).toBe(1);
    expect(metrics.grossVolumeByCurrency).toEqual({ XOF: 5_000 });
  });

  it('ne compte que le paiement de la vraie boutique dans la recette', async () => {
    const revenue = await getPlatformRevenue();
    expect(revenue.currentMonthByProduct.store).toEqual({ XOF: 10_000 });
    expect(revenue.allTime).toEqual({ XOF: 10_000 });
  });

  it('compte les vrais utilisateurs : ni démo, ni équipe, ni membres des seuls comptes de test', async () => {
    // Propriétaire de la vraie boutique + l'inscrit sans commerce.
    expect((await getPlatformMetrics()).users).toBe(2);
  });

  it('garde un paiement de test dans la file à valider', async () => {
    await prisma.storeSubscriptionPayment.create({
      data: { storeId: test.store.id, planId, provider: 'wave_manual', amount: 10_000, proofImageUrl: '/p.png' },
    });
    expect((await getPlatformRevenue()).pendingCount).toBe(1);
  });

  it('rend le compte aux chiffres quand on le démarque', async () => {
    await setStoreTestAccount({ storeId: test.store.id, isTest: false, actor: admin });
    expect((await getPlatformStoreMetrics()).stores).toBe(2);
  });
});
