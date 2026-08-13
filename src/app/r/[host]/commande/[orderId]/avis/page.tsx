import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { ReviewForm } from '@/components/site/review-form';

type Props = { params: Promise<{ host: string; orderId: string }> };

export const metadata: Metadata = {
  title: 'Laisser un avis',
  robots: { index: false, follow: false },
};

export default async function OrderReviewPage({ params }: Props) {
  const { host, orderId } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const entitlements = await getEntitlements(restaurant.id);
  if (!hasFeature(entitlements, FEATURES.REVIEWS)) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    select: { id: true, status: true, review: { select: { id: true } } },
  });
  if (!order) notFound();

  return (
    <div className="container-page max-w-xl py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Laisser un avis
      </h1>
      <p className="mt-2 text-ink-muted">
        Votre retour sur {restaurant.name} aide les prochains clients.
      </p>

      <div className="mt-8">
        {order.status !== 'COMPLETED' ? (
          <p className="rounded-2xl border border-surface-border p-5 text-sm text-ink-muted">
            Vous pourrez laisser un avis une fois votre commande terminée.
          </p>
        ) : order.review ? (
          <p className="rounded-2xl border border-surface-border p-5 text-sm text-ink-muted">
            Vous avez déjà laissé un avis pour cette commande. Merci !
          </p>
        ) : (
          <ReviewForm restaurantId={restaurant.id} orderId={order.id} />
        )}
      </div>
    </div>
  );
}
