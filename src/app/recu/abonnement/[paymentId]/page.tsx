import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant';
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
} from '@/components/documents';

export const metadata: Metadata = { title: "Reçu d'abonnement" };
export const dynamic = 'force-dynamic';

export default async function SubscriptionReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const context = await getTenantContext();
  if (!context || !context.permissions.has('subscription:view')) notFound();
  const { paymentId } = await params;

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentId, restaurantId: context.restaurant.id, status: 'APPROVED' },
    include: { plan: { select: { name: true } } },
  });
  if (!payment) notFound();

  const restaurant = context.restaurant;

  return (
    <div>
      <DocumentToolbar hint="Aperçu du reçu — imprimable ou exportable en PDF.">
        <PrintButton />
      </DocumentToolbar>

      {/* L'émetteur est ici MagyaPro et non le restaurant : c'est la
          plateforme qui facture son abonnement, et le restaurant qui le
          règle. Le sens des deux blocs est inversé par rapport aux autres
          documents, mais leur forme reste la même. */}
      <DocumentHeader
        issuer={{ name: 'MagyaPro', addressLine: "Reçu d'abonnement plateforme" }}
        kind="Reçu"
        number={`n°${payment.id.slice(-8).toUpperCase()}`}
        date={payment.reviewedAt ?? payment.createdAt}
      />

      <DocumentParty
        label="Facturé à"
        name={restaurant.name}
        lines={[restaurant.email, restaurant.phone]}
      />

      <DocumentLines
        currency={payment.currency}
        lines={[
          {
            id: payment.id,
            label: `Abonnement — ${payment.plan.name}`,
            detail: getProvider(payment.provider)?.label ?? payment.provider,
            quantity: '1',
            unitPrice: payment.amount,
            total: payment.amount,
          },
        ]}
      />

      <DocumentTotals rows={[]} total={payment.amount} currency={payment.currency} />

      <DocumentPayments
        currency={payment.currency}
        remaining={0}
        payments={[
          {
            id: payment.id,
            label: getProvider(payment.provider)?.label ?? payment.provider,
            amount: payment.amount,
          },
        ]}
      />

      <DocumentFooter issuerName={restaurant.name} />
    </div>
  );
}
