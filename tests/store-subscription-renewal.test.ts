import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import {
  approveStoreSubscriptionPayment,
  cancelStoreSubscriptionPaymentRequest,
  rejectStoreSubscriptionPayment,
  sendExpiringStoreSubscriptionAlerts,
  sendStalledStorePaymentReminders,
} from '@/lib/boutique/subscription-payments';
import { paymentReference } from '@/lib/boutique/subscription-reference';

const DAY = 24 * 60 * 60 * 1000;

describe('Abonnement Boutique — renouvellement manuel', () => {
  let shop: TestStore;
  let planId: string;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore();
    await prisma.store.update({ where: { id: shop.store.id }, data: { email: 'boutique@test.magyapro' } });
    const plan = await prisma.plan.create({
      data: { key: 'boutique-pro-test', name: 'Pro', product: 'STORE', price: 10_000, interval: 'MONTH' },
    });
    planId = plan.id;
  });

  beforeEach(async () => {
    await prisma.storeSubscriptionPayment.deleteMany({ where: { storeId: shop.store.id } });
    await prisma.notification.deleteMany({ where: { storeId: shop.store.id } });
    await prisma.platformNotification.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const setSubscription = (data: { status: 'ACTIVE' | 'TRIALING' | 'EXPIRED'; currentPeriodEnd: Date; expiryAlertSentAt?: Date | null }) =>
    prisma.storeSubscription.upsert({
      where: { storeId: shop.store.id },
      create: { storeId: shop.store.id, planId, ...data },
      update: { planId, graceEndsAt: null, expiryAlertSentAt: null, ...data },
    });

  const newPayment = (extra: { proofImageUrl?: string; proofSubmittedAt?: Date; createdAt?: Date } = {}) =>
    prisma.storeSubscriptionPayment.create({
      data: { storeId: shop.store.id, planId, provider: 'wave_manual', amount: 10_000, ...extra },
    });

  it('un renouvellement payé en avance ne fait perdre aucun jour', async () => {
    const end = new Date(Date.now() + 5 * DAY);
    await setSubscription({ status: 'ACTIVE', currentPeriodEnd: end });
    const payment = await newPayment({ proofImageUrl: '/p.png', proofSubmittedAt: new Date() });

    await approveStoreSubscriptionPayment({ paymentId: payment.id });

    const subscription = await prisma.storeSubscription.findUniqueOrThrow({ where: { storeId: shop.store.id } });
    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.currentPeriodEnd.getTime()).toBe(end.getTime() + 30 * DAY);

    // Le commerçant est prévenu, avec la nouvelle échéance.
    const notification = await prisma.notification.findFirstOrThrow({ where: { storeId: shop.store.id } });
    expect(notification.title).toBe('Paiement d’abonnement validé');
    expect(notification.type).toBe('PAYMENT_RECEIVED');
  });

  it('un abonnement expiré repart du jour de la validation', async () => {
    await setSubscription({ status: 'EXPIRED', currentPeriodEnd: new Date(Date.now() - 10 * DAY) });
    const payment = await newPayment({ proofImageUrl: '/p.png', proofSubmittedAt: new Date() });

    const before = Date.now();
    await approveStoreSubscriptionPayment({ paymentId: payment.id });

    const subscription = await prisma.storeSubscription.findUniqueOrThrow({ where: { storeId: shop.store.id } });
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(subscription.currentPeriodEnd.getTime()).toBeLessThan(before + 30 * DAY + 60_000);
  });

  it('un refus prévient le commerçant, avec le motif', async () => {
    const payment = await newPayment({ proofImageUrl: '/p.png', proofSubmittedAt: new Date() });
    await rejectStoreSubscriptionPayment({ paymentId: payment.id, note: 'montant incomplet' });
    const notification = await prisma.notification.findFirstOrThrow({ where: { storeId: shop.store.id } });
    expect(notification.body).toContain('montant incomplet');
  });

  it("annule une demande sans preuve, jamais une demande dont l'argent est peut-être parti", async () => {
    const empty = await newPayment();
    await cancelStoreSubscriptionPaymentRequest({
      storeId: shop.store.id,
      paymentId: empty.id,
      actorUserId: shop.owner.id,
      actorEmail: shop.owner.email,
    });
    expect(await prisma.storeSubscriptionPayment.count({ where: { id: empty.id } })).toBe(0);

    const withProof = await newPayment({ proofImageUrl: '/p.png', proofSubmittedAt: new Date() });
    await expect(
      cancelStoreSubscriptionPaymentRequest({
        storeId: shop.store.id,
        paymentId: withProof.id,
        actorUserId: shop.owner.id,
        actorEmail: shop.owner.email,
      }),
    ).rejects.toThrow('Une preuve a déjà été déposée');

    const other = await createTestStore();
    await expect(
      cancelStoreSubscriptionPaymentRequest({
        storeId: other.store.id,
        paymentId: withProof.id,
        actorUserId: other.owner.id,
        actorEmail: other.owner.email,
      }),
    ).rejects.toThrow('introuvable');
  });

  it('rappelle à 5 jours puis la veille, jamais deux fois le même rappel', async () => {
    await setSubscription({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 4 * DAY) });

    await sendExpiringStoreSubscriptionAlerts();
    await sendExpiringStoreSubscriptionAlerts();
    let notifications = await prisma.notification.findMany({ where: { storeId: shop.store.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.title).toBe('Abonnement bientôt à renouveler');
    expect(notifications[0]!.body).toMatch(/10\s000/);

    // La veille : le premier rappel date de trois jours.
    await setSubscription({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 20 * 60 * 60 * 1000),
      expiryAlertSentAt: new Date(Date.now() - 3 * DAY),
    });
    await sendExpiringStoreSubscriptionAlerts();
    await sendExpiringStoreSubscriptionAlerts();
    notifications = await prisma.notification.findMany({ where: { storeId: shop.store.id }, orderBy: { createdAt: 'asc' } });
    expect(notifications).toHaveLength(2);
    expect(notifications[1]!.title).toBe('Dernier rappel : abonnement à renouveler');
  });

  it("ne relance pas une boutique dont la preuve attend déjà d'être validée", async () => {
    await setSubscription({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 3 * DAY) });
    await newPayment({ proofImageUrl: '/p.png', proofSubmittedAt: new Date() });
    await sendExpiringStoreSubscriptionAlerts();
    expect(await prisma.notification.count({ where: { storeId: shop.store.id } })).toBe(0);
  });

  it('relance une seule fois un paiement resté en chemin, côté commerçant et côté MagyaPro', async () => {
    const now = new Date();
    const started = await newPayment({ createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000) });
    const awaiting = await newPayment({
      createdAt: new Date(now.getTime() - 40 * 60 * 60 * 1000),
      proofImageUrl: '/p.png',
      proofSubmittedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
    });
    await newPayment({ createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) });

    expect(await sendStalledStorePaymentReminders(now)).toEqual({ merchants: 1, admins: 1 });
    const merchant = await prisma.notification.findFirstOrThrow({ where: { storeId: shop.store.id } });
    expect(merchant.body).toContain(paymentReference(started.id));
    const admin = await prisma.platformNotification.findFirstOrThrow();
    expect(admin.body).toContain(paymentReference(awaiting.id));

    // Le passage du lendemain ne relance plus.
    expect(await sendStalledStorePaymentReminders(new Date(now.getTime() + DAY))).toEqual({ merchants: 1, admins: 0 });
  });

  it('dérive une référence courte et stable', () => {
    expect(paymentReference('cmv5bcuuj0009167d01wzwff9')).toBe('MP-WZWFF9');
  });
});
