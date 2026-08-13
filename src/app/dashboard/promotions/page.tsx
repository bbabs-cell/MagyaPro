import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { PromotionsManager } from '@/components/dashboard/promotions-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Promotions' };
export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  const context = await requireTenant('promotions:manage');

  const [promotions, entitlements] = await Promise.all([
    prisma.promotion.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { createdAt: 'desc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const enabled = hasFeature(entitlements, FEATURES.PROMOTIONS);

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Vos codes promo. Toutes les règles sont vérifiées côté serveur au moment de la commande."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Fonctionnalité non incluse dans votre plan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Les codes promotionnels sont disponibles à partir des plans
            supérieurs. Vos codes existants restent visibles mais ne peuvent pas
            être modifiés.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <PromotionsManager
        canManage={enabled}
        currency={context.restaurant.currency}
        promotions={promotions.map((promotion) => ({
          id: promotion.id,
          code: promotion.code,
          type: promotion.type,
          value: promotion.value,
          minOrder: promotion.minOrder,
          maxRedemptions: promotion.maxRedemptions,
          usedCount: promotion.usedCount,
          startsAt: promotion.startsAt?.toISOString() ?? null,
          endsAt: promotion.endsAt?.toISOString() ?? null,
          isActive: promotion.isActive,
        }))}
      />
    </>
  );
}
