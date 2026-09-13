import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant';
import { readOptions, describeOptions } from '@/lib/orders/option-snapshot';
import { getProvider } from '@/lib/payments/registry';
import { PrintButton } from '@/components/dashboard/print-button';
import {
  DocumentFooter,
  DocumentHeader,
  DocumentLines,
  DocumentParty,
  DocumentPayments,
  DocumentToolbar,
  DocumentTotals,
  type DocumentTotalRow,
} from '@/components/documents';

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
      include: {
        items: true,
        // Le règlement n'était pas lu par ce reçu : il ne disait ni si la
        // commande avait été payée, ni comment. C'est pourtant ce qu'un
        // client vient y chercher.
        payments: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: context.restaurant.id },
      select: { taxEnabled: true, taxRate: true, taxLabel: true },
    }),
  ]);
  if (!order) notFound();

  const restaurant = context.restaurant;
  const currency = order.currency;

  // Les prix restent TTC : le taux ne sert qu'à isoler la part de taxe déjà
  // comprise dans le total, pour la comptabilité du restaurateur.
  const taxIncluded =
    settings?.taxEnabled && settings.taxRate
      ? Math.round(order.total - order.total / (1 + settings.taxRate / 100))
      : null;

  // Un règlement encaissé par le livreur compte comme versé par le client :
  // c'est son point de vue que le reçu adopte. Voir `delivery-collection`.
  const settled = order.payments
    .filter((payment) => payment.status === 'PAID' || payment.status === 'PROCESSING')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const rows: DocumentTotalRow[] = [
    { label: 'Sous-total', amount: order.subtotal },
    ...(order.discount > 0
      ? [
          {
            label: order.promoCode ? `Remise (${order.promoCode})` : 'Remise',
            amount: order.discount,
            negative: true,
          },
        ]
      : []),
    ...(order.fulfillmentType === 'DELIVERY'
      ? [
          {
            label: 'Livraison',
            amount: order.deliveryFee,
            ...(order.deliveryFee === 0 ? { text: 'Offerte' } : {}),
          },
        ]
      : []),
  ];

  return (
    <div>
      <DocumentToolbar hint="Aperçu du reçu — imprimable ou exportable en PDF.">
        <PrintButton />
      </DocumentToolbar>

      <DocumentHeader
        issuer={{
          name: restaurant.name,
          logoUrl: restaurant.logoUrl,
          addressLine: restaurant.addressLine,
          city: restaurant.city,
          country: restaurant.country,
          phone: restaurant.phone,
          taxId: restaurant.legalId,
        }}
        kind="Reçu"
        number={`n°${order.number}`}
        date={order.placedAt}
      />

      <DocumentParty
        label="Client"
        name={order.customerName}
        lines={[order.customerPhone, order.deliveryAddress]}
      />

      <DocumentLines
        currency={currency}
        lines={order.items.map((item) => ({
          id: item.id,
          label: item.productName,
          // Les options choisies figuraient en base et n'étaient nulle part sur
          // le reçu : un client qui a payé un supplément doit le voir facturé.
          detail: [item.variantName, describeOptions(readOptions(item.options))]
            .filter(Boolean)
            .join(' · '),
          quantity: String(item.quantity),
          unitPrice: item.unitPrice,
          total: item.lineTotal,
        }))}
      />

      <DocumentTotals
        rows={rows}
        total={order.total}
        currency={currency}
        after={
          taxIncluded !== null
            ? [
                {
                  label: `dont ${settings!.taxLabel} (${settings!.taxRate} %)`,
                  amount: taxIncluded,
                },
              ]
            : undefined
        }
      />

      <DocumentPayments
        currency={currency}
        remaining={Math.max(0, order.total - settled)}
        emptyLabel="Aucun règlement enregistré pour cette commande."
        payments={order.payments
          .filter((payment) => payment.status === 'PAID' || payment.status === 'PROCESSING')
          .map((payment) => ({
            id: payment.id,
            label: getProvider(payment.provider)?.label ?? payment.provider,
            detail:
              payment.status === 'PROCESSING' ? 'encaissé par le livreur' : null,
            amount: payment.amount,
          }))}
      />

      <DocumentFooter issuerName={restaurant.name} />
    </div>
  );
}
