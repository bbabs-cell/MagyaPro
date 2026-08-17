import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { formatMoney } from '@/lib/money';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { OrderStatusTracker } from '@/components/site/order-status-tracker';
import { PaymentProofUpload } from '@/components/site/payment-proof-upload';
import { getServerDictionary } from '@/lib/i18n/server';

const MANUAL_MOBILE_MONEY_PROVIDERS = ['orange_money_manual', 'wave_manual'];

type Props = { params: Promise<{ host: string; orderId: string }> };

export const metadata: Metadata = {
  title: 'Confirmation de commande',
  robots: { index: false, follow: false },
};

/**
 * Page de confirmation.
 *
 * Elle est accessible sans authentification — le client n'a pas de compte —
 * mais l'identifiant de commande est un cuid non énumérable, et la requête est
 * filtrée par restaurant. Seules les informations utiles au client sont
 * affichées : ni marge, ni notes internes, ni coordonnées d'autres clients.
 */
export default async function OrderConfirmationPage({ params }: Props) {
  const { host, orderId } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      fulfillmentType: true,
      cancelReason: true,
      statusUpdatedAt: true,
      deliveryCode: true,
      courierLat: true,
      courierLng: true,
      courierLocationUpdatedAt: true,
      customerName: true,
      deliveryAddress: true,
      subtotal: true,
      discount: true,
      deliveryFee: true,
      total: true,
      currency: true,
      placedAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          lineTotal: true,
          options: true,
        },
      },
    },
  });

  if (!order) notFound();

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
    select: { provider: true, status: true, metadata: true, proofImageUrl: true },
  });
  const isManualMobileMoney = payment && MANUAL_MOBILE_MONEY_PROVIDERS.includes(payment.provider);
  const receivingNumber =
    payment && typeof payment.metadata === 'object' && payment.metadata !== null
      ? (payment.metadata as { receivingNumber?: string }).receivingNumber
      : undefined;

  const prepTime = restaurant.settings?.prepTimeMinutes ?? 30;
  const entitlements = await getEntitlements(restaurant.id);
  const reviewUrl = hasFeature(entitlements, FEATURES.REVIEWS)
    ? `/r/${host}/commande/${order.id}/avis`
    : undefined;

  // Récompenses de fidélité que cette commande précise vient de faire
  // franchir — visibles uniquement ici, au moment où elles sont gagnées.
  const loyaltyRewards = hasFeature(entitlements, FEATURES.LOYALTY)
    ? await prisma.loyaltyReward.findMany({
        where: { orderId: order.id },
        include: { tier: { select: { name: true } }, promotion: { select: { code: true } } },
      })
    : [];

  const { dict } = await getServerDictionary();

  return (
    <div className="container-page max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700"
        >
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          {dict.confirmation.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          {dict.confirmation.thanks(order.customerName, String(order.number), restaurant.name)}
        </p>
      </div>

      {loyaltyRewards.length > 0 && (
        <div className="mt-6 space-y-2">
          {loyaltyRewards.map((reward) => (
            <div
              key={reward.id}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"
            >
              <p className="font-medium text-amber-900">
                {dict.confirmation.tierReached(reward.tier.name)}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {dict.confirmation.rewardHint}{' '}
                <span className="font-mono font-semibold">{reward.promotion.code}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {isManualMobileMoney && receivingNumber && (
        <PaymentProofUpload
          orderId={order.id}
          provider={payment.provider}
          amount={order.total}
          currency={order.currency}
          receivingNumber={receivingNumber}
          status={payment.status}
          hasProof={Boolean(payment.proofImageUrl)}
        />
      )}

      <div className="mt-8">
        <OrderStatusTracker
          orderId={order.id}
          reviewUrl={reviewUrl}
          initial={{
            status: order.status,
            paymentStatus: order.paymentStatus,
            fulfillmentType: order.fulfillmentType,
            cancelReason: order.cancelReason,
            statusUpdatedAt: order.statusUpdatedAt.toISOString(),
            deliveryCode: order.fulfillmentType === 'DELIVERY' ? order.deliveryCode : null,
            courierLat: order.status === 'OUT_FOR_DELIVERY' ? order.courierLat : null,
            courierLng: order.status === 'OUT_FOR_DELIVERY' ? order.courierLng : null,
            courierLocationUpdatedAt:
              order.status === 'OUT_FOR_DELIVERY'
                ? (order.courierLocationUpdatedAt?.toISOString() ?? null)
                : null,
          }}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-surface-border p-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">{dict.confirmation.mode}</dt>
            <dd className="mt-0.5 font-medium">
              {order.fulfillmentType === 'DELIVERY'
                ? dict.cartPage.delivery
                : order.fulfillmentType === 'DINE_IN'
                  ? dict.confirmation.dineIn
                  : dict.cartPage.pickup}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">
              {dict.confirmation.prepEstimateLabel}
            </dt>
            <dd className="mt-0.5 font-medium">{dict.confirmation.prepEstimate(prepTime)}</dd>
          </div>
          {order.deliveryAddress && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">{dict.confirmation.address}</dt>
              <dd className="mt-0.5">{order.deliveryAddress}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-surface-border p-5">
        <h2 className="text-sm font-medium">{dict.confirmation.detail}</h2>
        <ul className="mt-3 divide-y divide-surface-border">
          {order.items.map((item) => {
            const options = Array.isArray(item.options)
              ? (item.options as Array<{ optionName: string }>)
              : [];
            return (
              <li key={item.id} className="flex justify-between gap-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{item.quantity} ×</span>{' '}
                  {item.productName}
                  {item.variantName && (
                    <span className="text-ink-muted"> · {item.variantName}</span>
                  )}
                  {options.length > 0 && (
                    <span className="block text-xs text-ink-muted">
                      {options.map((option) => option.optionName).join(', ')}
                    </span>
                  )}
                </span>
                <span className="shrink-0">
                  {formatMoney(item.lineTotal, order.currency)}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-surface-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">{dict.confirmation.subtotal}</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>{dict.confirmation.discount}</dt>
              <dd>−{formatMoney(order.discount, order.currency)}</dd>
            </div>
          )}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">{dict.confirmation.delivery}</dt>
              <dd>
                {order.deliveryFee === 0
                  ? dict.confirmation.free
                  : formatMoney(order.deliveryFee, order.currency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-surface-border pt-2 text-base font-semibold">
            <dt>{dict.confirmation.total}</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
      </div>

      {restaurant.phone && (
        <p className="mt-6 text-center text-sm text-ink-muted">
          {dict.confirmation.questionPrefix}{' '}
          <a href={`tel:${restaurant.phone}`} className="font-medium text-ink underline underline-offset-4">
            {restaurant.phone}
          </a>
        </p>
      )}

      <div className="mt-8 text-center">
        <Link
          href={`/r/${host}/menu`}
          className="inline-flex h-11 items-center rounded-xl border border-surface-border px-6 font-medium hover:bg-surface-sunken"
        >
          {dict.confirmation.backToMenu}
        </Link>
      </div>
    </div>
  );
}
