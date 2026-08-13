import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABELS } from '@/lib/orders/service';
import { PAYMENT_STATUS_LABELS } from '@/lib/payments/service';
import { getProvider } from '@/lib/payments/registry';
import { env } from '@/lib/env';
import { ORDER_STATUS_TONES } from '@/components/dashboard/order-status';
import { OrderActions } from '@/components/dashboard/order-actions';
import { WhatsAppNotifyButton } from '@/components/dashboard/whatsapp-notify-button';
import { Badge, Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Détail de la commande' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireTenant('orders:view');
  const { id } = await params;

  // Le filtre par restaurant fait partie de la requête : une commande d'un
  // autre tenant produit un 404, comme un identifiant inexistant.
  const order = await prisma.order.findFirst({
    where: { id, restaurantId: context.restaurant.id },
    include: {
      items: true,
      customer: { select: { id: true, ordersCount: true, totalSpent: true } },
      deliveryZone: { select: { name: true } },
      payments: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order) notFound();

  const currency = order.currency;

  return (
    <>
      <PageHeader
        title={`Commande n°${order.number}`}
        description={order.placedAt.toLocaleString('fr-FR', {
          dateStyle: 'full',
          timeStyle: 'short',
        })}
        action={
          <Link
            href="/dashboard/commandes"
            className="inline-flex h-9 items-center rounded-xl border border-surface-border bg-white px-3 text-sm hover:bg-surface-sunken"
          >
            Retour
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={ORDER_STATUS_TONES[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
                <span className="text-sm text-ink-muted">
                  Paiement : {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  {order.paymentProvider &&
                    ` · ${getProvider(order.paymentProvider)?.label ?? order.paymentProvider}`}
                </span>
              </div>

              {order.status !== 'CANCELLED' && (
                <WhatsAppNotifyButton
                  restaurantName={context.restaurant.name}
                  customerName={order.customerName}
                  customerPhone={order.customerPhone}
                  orderNumber={order.number}
                  status={order.status}
                  trackingUrl={`${env.appUrl}/r/${context.restaurant.slug}/commande/${order.id}`}
                />
              )}
            </div>

            <div className="mt-5">
              <OrderActions
                orderId={order.id}
                status={order.status}
                canUpdate={context.permissions.has('orders:update_status')}
                canCancel={context.permissions.has('orders:cancel')}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-medium">Articles</h2>
            <ul className="mt-3 divide-y divide-surface-border">
              {order.items.map((item) => {
                const options = Array.isArray(item.options)
                  ? (item.options as Array<{ groupName: string; optionName: string }>)
                  : [];
                return (
                  <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                    <div>
                      <p>
                        <span className="font-medium">{item.quantity} ×</span>{' '}
                        {item.productName}
                        {item.variantName && (
                          <span className="text-ink-muted"> · {item.variantName}</span>
                        )}
                      </p>
                      {options.length > 0 && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {options
                            .map((option) => `${option.groupName} : ${option.optionName}`)
                            .join(' · ')}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatMoney(item.unitPrice, currency)} l&apos;unité
                      </p>
                    </div>
                    <span className="shrink-0 font-medium">
                      {formatMoney(item.lineTotal, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-4 space-y-1.5 border-t border-surface-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Sous-total</dt>
                <dd>{formatMoney(order.subtotal, currency)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Remise {order.promoCode && `(${order.promoCode})`}</dt>
                  <dd>−{formatMoney(order.discount, currency)}</dd>
                </div>
              )}
              {order.fulfillmentType === 'DELIVERY' && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">
                    Livraison
                    {order.deliveryZone && ` · ${order.deliveryZone.name}`}
                  </dt>
                  <dd>
                    {order.deliveryFee === 0
                      ? 'Offerte'
                      : formatMoney(order.deliveryFee, currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-surface-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(order.total, currency)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-medium">Historique</h2>
            <ol className="mt-3 space-y-2.5">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint"
                  />
                  <span>
                    <span className="font-medium">
                      {ORDER_STATUS_LABELS[event.toStatus]}
                    </span>
                    {event.fromStatus && (
                      <span className="text-ink-muted">
                        {' '}
                        (depuis {ORDER_STATUS_LABELS[event.fromStatus]})
                      </span>
                    )}
                    <span className="block text-xs text-ink-faint">
                      {event.createdAt.toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {event.note && (
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {event.note}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-medium">Client</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Nom</dt>
                <dd className="mt-0.5">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">
                  Téléphone
                </dt>
                <dd className="mt-0.5">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="underline underline-offset-4"
                  >
                    {order.customerPhone}
                  </a>
                </dd>
              </div>
              {order.customerEmail && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                  <dd className="mt-0.5 break-all">{order.customerEmail}</dd>
                </div>
              )}
              {order.deliveryAddress && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    Adresse
                  </dt>
                  <dd className="mt-0.5">{order.deliveryAddress}</dd>
                </div>
              )}
              {order.instructions && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">
                    Instructions
                  </dt>
                  <dd className="mt-0.5">{order.instructions}</dd>
                </div>
              )}
            </dl>

            {context.permissions.has('customers:view') && (
              <p className="mt-4 border-t border-surface-border pt-3 text-xs text-ink-muted">
                {order.customer.ordersCount} commande
                {order.customer.ordersCount > 1 ? 's' : ''} ·{' '}
                {formatMoney(order.customer.totalSpent, currency)} dépensés
              </p>
            )}
          </Card>

          {context.permissions.has('payments:view') && order.payments.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-medium">Paiements</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id}>
                    <p className="font-medium">
                      {getProvider(payment.provider)?.label ?? payment.provider}
                    </p>
                    <p className="text-ink-muted">
                      {formatMoney(payment.amount, payment.currency)} ·{' '}
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-ink-faint">
                      {payment.reference}
                    </p>
                    {payment.failureReason && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {payment.failureReason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
