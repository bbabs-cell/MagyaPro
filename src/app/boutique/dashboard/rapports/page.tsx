import type { Metadata } from 'next';
import type { Prisma, SaleStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { PrintButton } from '@/components/dashboard/print-button';

export const metadata: Metadata = { title: 'Rapports de ventes' };
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Complétée',
  REFUNDED: 'Remboursée',
  PARTIALLY_REFUNDED: 'Partiellement remboursée',
  CANCELLED: 'Annulée',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  card: 'Carte',
  wave: 'Wave',
};

function startOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  return date;
}

function endOfDay(value: string): Date {
  const date = new Date(`${value}T23:59:59.999`);
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function BoutiqueRapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ du?: string; au?: string; statut?: string; paiement?: string }>;
}) {
  const context = await requireStore('sales:view');
  const params = await searchParams;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = params.du ? startOfDay(params.du) : defaultFrom;
  const to = params.au ? endOfDay(params.au) : now;
  const status = params.statut && params.statut in STATUS_LABELS ? params.statut : undefined;
  const method = params.paiement && (params.paiement === 'credit' || params.paiement in PAYMENT_LABELS)
    ? params.paiement
    : undefined;

  const where: Prisma.SaleWhereInput = {
    storeId: context.store.id,
    createdAt: { gte: from, lte: to },
    ...(status ? { status: status as SaleStatus } : {}),
    ...(method === 'credit'
      ? { creditAmount: { gt: 0 } }
      : method
        ? { payments: { some: { method } } }
        : {}),
  };

  const [sales, aggregate] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        number: true,
        createdAt: true,
        status: true,
        subtotal: true,
        discount: true,
        taxAmount: true,
        total: true,
        creditAmount: true,
        customer: { select: { name: true } },
        payments: { select: { method: true } },
      },
    }),
    prisma.sale.aggregate({
      where,
      _sum: { total: true, discount: true, taxAmount: true },
      _count: true,
    }),
  ]);

  const currency = context.store.currency;

  return (
    <>
      <PageHeader
        title="Rapports de ventes"
        description="Filtrez par période, statut et moyen de paiement — imprimable ou exportable en PDF."
        action={<PrintButton />}
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Du</span>
          <input
            type="date"
            name="du"
            defaultValue={isoDate(from)}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Au</span>
          <input
            type="date"
            name="au"
            defaultValue={isoDate(to)}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Statut</span>
          <select
            name="statut"
            defaultValue={status ?? ''}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Paiement</span>
          <select
            name="paiement"
            defaultValue={method ?? ''}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="credit">Crédit</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-white"
        >
          Filtrer
        </button>
      </form>

      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventes" value={String(aggregate._count)} />
        <StatCard label="Chiffre d'affaires" value={formatMoney(aggregate._sum.total ?? 0, currency)} />
        <StatCard label="Remises accordées" value={formatMoney(aggregate._sum.discount ?? 0, currency)} />
        <StatCard label="TVA collectée" value={formatMoney(aggregate._sum.taxAmount ?? 0, currency)} />
      </section>

      <p className="mb-3 hidden text-sm text-ink-muted print:block">
        {context.store.name} — du {isoDate(from)} au {isoDate(to)}
      </p>

      <Card className="overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Vente</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Paiement</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Aucune vente sur cette période avec ces filtres.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="border-b border-surface-border last:border-0">
                  <td data-label="Vente" className="px-4 py-3">
                    <p className="font-medium">n°{sale.number}</p>
                    <p className="text-xs text-ink-faint">
                      {sale.createdAt.toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td data-label="Client" className="px-4 py-3 text-ink-muted">
                    {sale.customer?.name ?? 'Client de passage'}
                  </td>
                  <td data-label="Paiement" className="px-4 py-3 text-ink-muted">
                    {sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join(', ') || '—'}
                    {sale.creditAmount > 0 && (
                      <span className="text-amber-700">
                        {sale.payments.length > 0 ? ' + ' : ''}crédit
                      </span>
                    )}
                  </td>
                  <td data-label="Statut" className="px-4 py-3">
                    <Badge tone={sale.status === 'COMPLETED' ? 'success' : 'neutral'}>
                      {STATUS_LABELS[sale.status]}
                    </Badge>
                  </td>
                  <td data-label="Total" className="px-4 py-3 text-right font-medium">
                    {formatMoney(sale.total, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {sales.length === 500 && (
        <p className="mt-3 text-center text-xs text-ink-faint print:hidden">
          Affichage limité aux 500 ventes les plus récentes de la période — affinez les filtres pour
          un rapport plus précis.
        </p>
      )}

      <p className="mt-3 text-xs text-ink-faint print:hidden">
        <a href="/boutique/dashboard/rapports" className="underline underline-offset-4">
          Réinitialiser les filtres
        </a>
      </p>
    </>
  );
}
