import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { PrintButton } from '@/components/dashboard/print-button';

export const metadata: Metadata = { title: "Reçu d'abonnement" };
export const dynamic = 'force-dynamic';

const PROVIDER_LABELS: Record<string, string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

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
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-muted">Aperçu du reçu — imprimable ou exportable en PDF.</p>
        <PrintButton />
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink pb-4">
        <div>
          <p className="text-lg font-bold">Magyapro</p>
          <p className="text-sm text-ink-muted">Reçu d&apos;abonnement plateforme</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Reçu</p>
          <p className="text-sm text-ink-muted break-all">{payment.id}</p>
          <p className="text-sm text-ink-muted">
            {(payment.reviewedAt ?? payment.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Facturé à</p>
        <p className="mt-1 text-sm">{restaurant.name}</p>
        {restaurant.email && <p className="text-sm text-ink-muted">{restaurant.email}</p>}
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-ink-faint text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Moyen</th>
            <th className="py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-surface-border">
            <td className="py-2">Abonnement — {payment.plan.name}</td>
            <td className="py-2 text-right">
              {PROVIDER_LABELS[payment.provider] ?? payment.provider}
            </td>
            <td className="py-2 text-right">{formatMoney(payment.amount, payment.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between border-t border-ink pt-1.5 text-base font-bold">
          <span>Total payé</span>
          <span>{formatMoney(payment.amount, payment.currency)}</span>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">Généré par Magyapro</p>
    </div>
  );
}
