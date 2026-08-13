import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/db';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';

/**
 * Programme de fidélité.
 *
 * Chaque palier franchi génère un code promo à usage unique, réutilisant le
 * moteur de promotions existant plutôt qu'un système de récompense parallèle
 * — la remise s'applique donc exactement comme n'importe quel autre code, sans
 * logique de tarification dupliquée.
 */

function generateLoyaltyCode(): string {
  return `FID${randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Vérifie si une commande vient de faire franchir un ou plusieurs paliers, et
 * accorde les récompenses correspondantes.
 *
 * Appelé après la transaction de création de commande : un incident ici ne
 * doit jamais annuler une commande déjà passée, d'où le try/catch qui avale
 * l'erreur après l'avoir journalisée.
 */
export async function grantLoyaltyRewards(params: {
  restaurantId: string;
  customerId: string;
  orderId: string;
  customerTotalSpent: number;
}): Promise<void> {
  try {
    const entitlements = await getEntitlements(params.restaurantId);
    if (!hasFeature(entitlements, FEATURES.LOYALTY)) return;

    const tiers = await prisma.loyaltyTier.findMany({
      where: {
        restaurantId: params.restaurantId,
        isActive: true,
        thresholdSpent: { lte: params.customerTotalSpent },
      },
    });
    if (tiers.length === 0) return;

    const already = await prisma.loyaltyReward.findMany({
      where: { customerId: params.customerId, tierId: { in: tiers.map((tier) => tier.id) } },
      select: { tierId: true },
    });
    const grantedTierIds = new Set(already.map((reward) => reward.tierId));
    const newTiers = tiers.filter((tier) => !grantedTierIds.has(tier.id));

    for (const tier of newTiers) {
      const promotion = await prisma.promotion.create({
        data: {
          restaurantId: params.restaurantId,
          code: generateLoyaltyCode(),
          type: tier.rewardType,
          value: tier.rewardValue,
          maxRedemptions: 1,
          isActive: true,
        },
      });

      await prisma.loyaltyReward.create({
        data: {
          restaurantId: params.restaurantId,
          customerId: params.customerId,
          tierId: tier.id,
          promotionId: promotion.id,
          orderId: params.orderId,
        },
      });
    }
  } catch (error) {
    console.error('[loyalty] Échec de l\'attribution de récompense :', error);
  }
}
