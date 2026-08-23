import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { PromotionsManager } from '@/components/boutique/promotions-manager';

export const metadata: Metadata = { title: 'Promotions' };
export const dynamic = 'force-dynamic';

export default async function BoutiquePromotionsPage() {
  const context = await requireStore('promotions:manage');

  const promotions = await prisma.storePromotion.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Codes promo à présenter en caisse — remise en pourcentage ou montant fixe."
      />

      <PromotionsManager
        initialPromotions={promotions.map((p) => ({
          id: p.id,
          code: p.code,
          type: p.type,
          value: p.value,
          minCartAmount: p.minCartAmount,
          maxRedemptions: p.maxRedemptions,
          usedCount: p.usedCount,
          startsAt: p.startsAt?.toISOString() ?? null,
          endsAt: p.endsAt?.toISOString() ?? null,
          isActive: p.isActive,
        }))}
        currency={context.store.currency}
        canManage={context.permissions.has('promotions:manage')}
      />
    </>
  );
}
