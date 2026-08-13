import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { LoyaltyManager } from '@/components/dashboard/loyalty-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Fidélité' };
export const dynamic = 'force-dynamic';

export default async function LoyaltyPage() {
  const context = await requireTenant('loyalty:manage');

  const [tiers, recentRewards, entitlements] = await Promise.all([
    prisma.loyaltyTier.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { thresholdSpent: 'asc' },
    }),
    prisma.loyaltyReward.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { grantedAt: 'desc' },
      take: 20,
      include: {
        customer: { select: { name: true } },
        tier: { select: { name: true } },
        promotion: { select: { code: true, usedCount: true } },
      },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const enabled = hasFeature(entitlements, FEATURES.LOYALTY);

  return (
    <>
      <PageHeader
        title="Fidélité"
        description="Un client franchit un palier, il reçoit automatiquement un code promo à usage unique."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Fonctionnalité non incluse dans votre plan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Le programme de fidélité est disponible à partir des plans
            supérieurs.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <LoyaltyManager
        canManage={enabled}
        currency={context.restaurant.currency}
        tiers={tiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          thresholdSpent: tier.thresholdSpent,
          rewardType: tier.rewardType,
          rewardValue: tier.rewardValue,
          isActive: tier.isActive,
        }))}
        recentRewards={recentRewards.map((reward) => ({
          id: reward.id,
          customerName: reward.customer.name,
          tierName: reward.tier.name,
          code: reward.promotion.code,
          used: reward.promotion.usedCount > 0,
          grantedAt: reward.grantedAt.toISOString(),
        }))}
      />
    </>
  );
}
