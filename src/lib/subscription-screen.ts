import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getPlatformSettings } from '@/lib/platform-settings';
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  getEntitlements,
  type Feature,
  type PlanLimits,
} from '@/lib/entitlements';

/**
 * Données de l'écran de paiement d'abonnement Restaurant.
 *
 * Deux écrans le montrent : la page Abonnement, et le mur qui remplace le
 * tableau de bord quand l'abonnement n'est plus actif. Ils doivent proposer
 * exactement les mêmes plans, aux mêmes montants — un restaurateur qui voit un
 * prix sur un écran et un autre ailleurs n'a aucune raison de faire confiance
 * au premier.
 *
 * Ce chargeur existait déjà côté Boutique (`boutique/subscription-screen.ts`)
 * et le mur Boutique s'en sert pour afficher le formulaire de paiement
 * directement. Côté Restaurant, la page assemblait ces données **en ligne**,
 * si bien que le mur ne pouvait rien réutiliser : il ne savait proposer qu'un
 * lien. D'où ce module, calqué sur son équivalent.
 *
 * Tout est formé ici, côté serveur : le composant client ne reçoit que du
 * texte déjà prêt, aucune fonction ne traverse la frontière serveur/client.
 */

export type SubscriptionScreen = Awaited<ReturnType<typeof loadSubscriptionScreen>>;

/** Libellé d'une fonctionnalité, humanisé en repli s'il est plus récent que ce déploiement. */
function featureLabel(key: string): string {
  return (
    FEATURE_LABELS[key as Feature] ??
    key.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase())
  );
}

/** « Jusqu'à 150 produits », « Catégories en illimité ». */
function limitLines(limits: Record<string, unknown>): string[] {
  return Object.entries(limits).map(([key, value]) => {
    const label = LIMIT_LABELS[key as keyof PlanLimits] ?? key;
    const amount = typeof value === 'number' ? value : undefined;
    return amount === undefined || amount === -1
      ? `${label} en illimité`
      : `Jusqu'à ${amount} ${label.toLowerCase()}`;
  });
}

export async function loadSubscriptionScreen(restaurantId: string) {
  const [entitlements, plans, platformSettings, pendingPayment] = await Promise.all([
    getEntitlements(restaurantId),
    prisma.plan.findMany({
      where: { isActive: true, product: 'RESTAURANT' },
      orderBy: { position: 'asc' },
    }),
    getPlatformSettings(),
    prisma.subscriptionPayment.findFirst({
      where: { restaurantId, status: 'PENDING' },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  const availableProviders: Array<'wave_manual' | 'orange_money_manual'> = [
    ...(platformSettings?.waveNumber ? (['wave_manual'] as const) : []),
    ...(platformSettings?.orangeMoneyNumber ? (['orange_money_manual'] as const) : []),
  ];

  const receivingNumberFor = (provider: string) =>
    provider === 'wave_manual'
      ? (platformSettings?.waveNumber ?? '')
      : (platformSettings?.orangeMoneyNumber ?? '');

  return {
    entitlements,
    availableProviders,
    /**
     * « Plan actuel » veut dire *en cours*, pas *dernier connu*.
     *
     * Les cartes marquent le plan actuel d'une pastille et lui retirent son
     * bouton de paiement — on ne repaie pas ce qu'on a déjà. Mais un
     * abonnement expiré gardait cette étiquette : sur le mur de blocage, le
     * plan que le restaurateur venait de perdre s'affichait « Actuel », sans
     * bouton. Il ne pouvait donc pas reprendre son propre plan, seulement en
     * choisir un autre.
     *
     * Dès que l'accès n'est plus actif, aucun plan n'est courant.
     */
    currentPlanKey: entitlements.isActive ? entitlements.planKey : null,
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
      price: plan.price,
      interval: plan.interval,
      trialDays: plan.trialDays,
      limits: limitLines((plan.limits ?? {}) as Record<string, unknown>),
      features: plan.features.map(featureLabel),
    })),
  };
}
