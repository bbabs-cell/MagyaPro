import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Ventes' };
export const dynamic = 'force-dynamic';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte',
};

export default async function BoutiqueSalesPage() {
  const context = await requireStore('sales:view');

  const sales = await prisma.sale.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: { select: { id: true } },
      payments: { select: { method: true } },
    },
  });

  return (
    <>
      <PageHeader title="Ventes" description="Les 100 dernières ventes de la boutique." />

      {sales.length === 0 ? (
        <EmptyState
          title="Aucune vente pour le moment"
          description="Les ventes réalisées depuis la caisse apparaîtront ici."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Vente</th>
                <th className="px-4 py-3 font-medium">Articles</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-surface-border last:border-0">
                  <td data-label="Vente" className="px-4 py-3">
                    <p className="font-medium">n°{sale.number}</p>
                    <p className="text-xs text-ink-faint">
                      {sale.createdAt.toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td data-label="Articles" className="px-4 py-3 text-ink-muted">
                    {sale.items.length} article{sale.items.length > 1 ? 's' : ''}
                  </td>
                  <td data-label="Paiement" className="px-4 py-3 text-ink-muted">
                    {sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join(', ')}
                  </td>
                  <td data-label="Total" className="px-4 py-3 text-right font-medium">
                    {formatMoney(sale.total, context.store.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
