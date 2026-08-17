import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { PrintButton } from '@/components/dashboard/print-button';

export const metadata: Metadata = { title: 'Reçu de commande' };
export const dynamic = 'force-dynamic';

export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getTenantContext();
  if (!context || !context.permissions.has('orders:view')) notFound();
  const { id } = await params;

  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: { id, restaurantId: context.restaurant.id },
      include: { items: true },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: context.restaurant.id },
      select: { taxEnabled: true, taxRate: true, taxLabel: true },
    }),
  ]);
  if (!order) notFound();

  const restaurant = context.restaurant;
  const currency = order.currency;

  // Les prix restent TTC : le taux ne sert qu'à isoler la part de TVA déjà
  // comprise dans le total, pour la comptabilité du restaurateur.
  const taxIncluded =
    settings?.taxEnabled && settings.taxRate
      ? order.total - order.total / (1 + settings.taxRate / 100)
      : null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-muted">Aperçu du reçu — imprimable ou exportable en PDF.</p>
        <PrintButton />
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink pb-4">
        <div>
          <p className="text-lg font-bold">{restaurant.name}</p>
          {restaurant.addressLine && <p className="text-sm text-ink-muted">{restaurant.addressLine}</p>}
          {(restaurant.city || restaurant.country) && (
            <p className="text-sm text-ink-muted">
              {[restaurant.city, restaurant.country].filter(Boolean).join(', ')}
            </p>
          )}
          {restaurant.phone && <p className="text-sm text-ink-muted">{restaurant.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Reçu</p>
          <p className="text-lg font-bold">n°{order.number}</p>
          <p className="text-sm text-ink-muted">
            {order.placedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Client</p>
        <p className="mt-1 text-sm">{order.customerName}</p>
        <p className="text-sm text-ink-muted">{order.customerPhone}</p>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-ink-faint text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 font-medium">Article</th>
            <th className="py-2 text-right font-medium">Qté</th>
            <th className="py-2 text-right font-medium">Prix unitaire</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-surface-border">
              <td className="py-2">
                {item.productName}
                {item.variantName && <span className="text-ink-muted"> · {item.variantName}</span>}
              </td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatMoney(item.unitPrice, currency)}</td>
              <td className="py-2 text-right">{formatMoney(item.lineTotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Sous-total</span>
          <span>{formatMoney(order.subtotal, currency)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Remise{order.promoCode && ` (${order.promoCode})`}</span>
            <span>−{formatMoney(order.discount, currency)}</span>
          </div>
        )}
        {order.fulfillmentType === 'DELIVERY' && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Livraison</span>
            <span>{order.deliveryFee === 0 ? 'Offerte' : formatMoney(order.deliveryFee, currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-ink pt-1.5 text-base font-bold">
          <span>Total</span>
          <span>{formatMoney(order.total, currency)}</span>
        </div>
        {taxIncluded !== null && (
          <div className="flex justify-between text-xs text-ink-faint">
            <span>dont {settings!.taxLabel} ({settings!.taxRate}%)</span>
            <span>{formatMoney(Math.round(taxIncluded), currency)}</span>
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">
        Généré par Magyapro pour {restaurant.name}
      </p>
    </div>
  );
}
