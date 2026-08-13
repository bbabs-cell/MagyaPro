import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { formatMoney } from '@/lib/money';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { OrderStatusTracker } from '@/components/site/order-status-tracker';

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

  const prepTime = restaurant.settings?.prepTimeMinutes ?? 30;
  const entitlements = await getEntitlements(restaurant.id);
  const reviewUrl = hasFeature(entitlements, FEATURES.REVIEWS)
    ? `/r/${host}/commande/${order.id}/avis`
    : undefined;

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
          Commande enregistrée
        </h1>
        <p className="mt-2 text-ink-muted">
          Merci {order.customerName}. Votre commande n°{order.number} a bien été
          transmise à {restaurant.name}.
        </p>
      </div>

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
          }}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-surface-border p-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Mode</dt>
            <dd className="mt-0.5 font-medium">
              {order.fulfillmentType === 'DELIVERY'
                ? 'Livraison'
                : order.fulfillmentType === 'DINE_IN'
                  ? 'Sur place'
                  : 'Retrait sur place'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">
              Préparation estimée
            </dt>
            <dd className="mt-0.5 font-medium">environ {prepTime} minutes</dd>
          </div>
          {order.deliveryAddress && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Adresse</dt>
              <dd className="mt-0.5">{order.deliveryAddress}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-surface-border p-5">
        <h2 className="text-sm font-medium">Détail</h2>
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
            <dt className="text-ink-muted">Sous-total</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Remise</dt>
              <dd>−{formatMoney(order.discount, order.currency)}</dd>
            </div>
          )}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Livraison</dt>
              <dd>
                {order.deliveryFee === 0
                  ? 'Offerte'
                  : formatMoney(order.deliveryFee, order.currency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-surface-border pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
      </div>

      {restaurant.phone && (
        <p className="mt-6 text-center text-sm text-ink-muted">
          Une question ? Appelez le restaurant au{' '}
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
          Retour au menu
        </Link>
      </div>
    </div>
  );
}
