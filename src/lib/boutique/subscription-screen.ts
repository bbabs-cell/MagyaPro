import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getPlatformSettings } from '@/lib/platform-settings';
import { STORE_FEATURE_LABELS, STORE_LIMIT_LABELS, type StoreFeature } from '@/lib/boutique/entitlements';
import {
  additionalStorePrice,
  getAdditionalStorePercent,
  getGroupPlanKey,
  getStoreBillingPosition,
} from '@/lib/boutique/store-pricing';

/**
 * Données de l'écran de paiement d'abonnement Boutique.
 *
 * Deux écrans le montrent : la page Abonnement, et le mur qui remplace le
 * tableau de bord quand la boutique n'a pas d'abonnement utilisable. Ils
 * doivent proposer exactement les mêmes plans, aux mêmes montants, avec les
 * mêmes règles — un commerçant qui voit 18 750 sur un écran et 25 000 sur
 * l'autre n'a aucune raison de faire confiance au premier.
 *
 * D'où ce chargement unique. Tout est calculé ici, côté serveur : les libellés
 * de prix comme les limites. Le composant client ne reçoit que du texte déjà
 * formé, aucune fonction ne traverse la frontière serveur/client.
 */

export type StoreSubscriptionScreen = Awaited<ReturnType<typeof loadStoreSubscriptionScreen>>;

/** Libellé d'une clé de fonctionnalité, humanisée en repli si elle est plus récente que ce déploiement. */
function featureLabel(key: string): string {
  return (
    STORE_FEATURE_LABELS[key as StoreFeature] ??
    key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/** « Jusqu'à 200 produits », « Utilisateurs en illimité ». */
function limitLines(limits: Record<string, unknown>): string[] {
  return Object.entries(limits).map(([key, value]) => {
    const label = STORE_LIMIT_LABELS[key as keyof typeof STORE_LIMIT_LABELS] ?? key;
    const amount = typeof value === 'number' ? value : undefined;
    return amount === undefined || amount === -1
      ? `${label} en illimité`
      : `Jusqu'à ${amount} ${label.toLowerCase()}`;
  });
}

export async function loadStoreSubscriptionScreen(storeId: string) {
  const [subscription, plans, platformSettings, pendingPayment, position, surchargePercent, groupPlanKey] =
    await Promise.all([
      prisma.storeSubscription.findUnique({ where: { storeId }, include: { plan: true } }),
      prisma.plan.findMany({
        where: { isActive: true, product: 'STORE' },
        orderBy: { position: 'asc' },
      }),
      getPlatformSettings(),
      prisma.storeSubscriptionPayment.findFirst({
        where: { storeId, status: 'PENDING' },
        include: { plan: { select: { name: true } } },
      }),
      getStoreBillingPosition(storeId),
      getAdditionalStorePercent(),
      getGroupPlanKey(storeId),
    ]);

  // Montant réellement dû par cette boutique. Une boutique supplémentaire paie
  // un pourcentage du tarif du plan ; la première paie le tarif entier.
  const amountFor = (price: number) =>
    position.isAdditional ? additionalStorePrice(price, surchargePercent) : price;

  // Le verrouillage sur le plan de la boutique principale ne vaut que si ce
  // plan figure vraiment parmi ceux proposés. Sinon toutes les cartes seraient
  // verrouillées et la boutique n'aurait plus aucun moyen de payer.
  const lockedPlanKey =
    groupPlanKey && plans.some((plan) => plan.key === groupPlanKey) ? groupPlanKey : null;

  const availableProviders: Array<'wave_manual' | 'orange_money_manual'> = [
    ...(platformSettings?.waveNumber ? (['wave_manual'] as const) : []),
    ...(platformSettings?.orangeMoneyNumber ? (['orange_money_manual'] as const) : []),
  ];

  const receivingNumberFor = (provider: string) =>
    provider === 'wave_manual'
      ? (platformSettings?.waveNumber ?? '')
      : (platformSettings?.orangeMoneyNumber ?? '');

  return {
    subscription,
    availableProviders,
    currentPlanKey: subscription?.plan.key ?? null,
    billing: {
      isAdditional: position.isAdditional,
      percent: position.isAdditional ? surchargePercent : null,
      lockedPlanKey,
    },
    pendingPayment: pendingPayment
      ? {
          id: pendingPayment.id,
          planName: pendingPayment.plan.name,
          amountLabel: formatMoney(pendingPayment.amount, pendingPayment.currency),
          provider: pendingPayment.provider as 'wave_manual' | 'orange_money_manual',
          receivingNumber: receivingNumberFor(pendingPayment.provider),
          proofImageUrl: pendingPayment.proofImageUrl,
        }
      : null,
    plans: plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceLabel: formatMoney(plan.price, plan.currency),
      amountLabel: formatMoney(amountFor(plan.price), plan.currency),
      price: plan.price,
      interval: plan.interval,
      trialDays: plan.trialDays,
      limits: limitLines((plan.limits ?? {}) as Record<string, unknown>),
      features: plan.features.map(featureLabel),
    })),
  };
}
