import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { ReviewsManager } from '@/components/dashboard/reviews-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Avis' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const context = await requireTenant('reviews:moderate');

  const [reviews, entitlements] = await Promise.all([
    prisma.review.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { number: true } } },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const enabled = hasFeature(entitlements, FEATURES.REVIEWS);

  return (
    <>
      <PageHeader
        title="Avis clients"
        description="Rien n'est publié sur votre site sans votre validation."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Fonctionnalité non incluse dans votre plan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Les avis clients sont disponibles à partir des plans supérieurs.
            Vos clients ne peuvent pas encore en laisser sur votre site.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <ReviewsManager
        canModerate={enabled}
        reviews={reviews.map((review) => ({
          id: review.id,
          customerName: review.customerName,
          rating: review.rating,
          comment: review.comment,
          status: review.status,
          createdAt: review.createdAt.toISOString(),
          orderNumber: review.order?.number ?? null,
        }))}
      />
    </>
  );
}
