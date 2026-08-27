import type { Metadata } from 'next';
import type { Prisma, SaleStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { formatQty } from '@/lib/boutique/quantity';
import {
  getCustomersReport,
  getEmployeesReport,
  getExpensesReport,
  getPurchasesReport,
  getStockMovementsReport,
  getSuppliersReport,
  getTaxReport,
} from '@/lib/boutique/reports';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { PrintButton } from '@/components/dashboard/print-button';

export const metadata: Metadata = { title: 'Rapports' };
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

const PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ORDERED: 'Commandée',
  PARTIALLY_RECEIVED: 'Partiellement reçue',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Achat',
  SALE: 'Vente',
  RETURN: 'Retour',
  ADJUSTMENT: 'Ajustement',
  TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant',
  INITIAL: 'Stock initial',
};

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Loyer',
  UTILITIES: 'Charges',
  STAFF: 'Personnel',
  TRANSPORT: 'Transport',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Entretien',
  SUPPLIES: 'Fournitures',
  OTHER: 'Autre',
};

const REPORT_TABS = [
  { value: 'ventes', label: 'Ventes' },
  { value: 'achats', label: 'Achats' },
  { value: 'stock', label: 'Stock' },
  { value: 'clients', label: 'Clients' },
  { value: 'fournisseurs', label: 'Fournisseurs' },
  { value: 'depenses', label: 'Dépenses' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'employes', label: 'Employés' },
] as const;
type ReportType = (typeof REPORT_TABS)[number]['value'];

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999`);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function BoutiqueRapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; du?: string; au?: string; statut?: string; paiement?: string }>;
}) {
  const context = await requireStore('reports:view');
  const params = await searchParams;
  const currency = context.store.currency;

  const type: ReportType = REPORT_TABS.some((t) => t.value === params.type)
    ? (params.type as ReportType)
    : 'ventes';

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from = params.du ? startOfDay(params.du) : defaultFrom;
  const to = params.au ? endOfDay(params.au) : now;

  const dateQuery = `du=${isoDate(from)}&au=${isoDate(to)}`;

  return (
    <>
      <PageHeader
        title="Rapports"
        description="Filtrez par période — imprimables ou exportables en PDF."
        action={<PrintButton />}
      />

      <nav aria-label="Type de rapport" className="mb-4 flex flex-wrap gap-2 print:hidden">
        {REPORT_TABS.map((tab) => (
          <a
            key={tab.value}
            href={`/boutique/dashboard/rapports?type=${tab.value}&${dateQuery}`}
            aria-current={type === tab.value ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              type === tab.value ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {type !== 'clients' && type !== 'fournisseurs' && (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
          <input type="hidden" name="type" value={type} />
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
          {type === 'ventes' && (
            <>
              <StatutSelect defaultValue={params.statut} />
              <PaiementSelect defaultValue={params.paiement} />
            </>
          )}
          <button type="submit" className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-white">
            Filtrer
          </button>
        </form>
      )}

      <p className="mb-3 hidden text-sm text-ink-muted print:block">
        {context.store.name} — {REPORT_TABS.find((t) => t.value === type)!.label}
        {type !== 'clients' && type !== 'fournisseurs' && ` — du ${isoDate(from)} au ${isoDate(to)}`}
      </p>

      {type === 'ventes' && (
        <VentesReport
          storeId={context.store.id}
          currency={currency}
          from={from}
          to={to}
          statut={params.statut}
          paiement={params.paiement}
        />
      )}
      {type === 'achats' && <AchatsReport storeId={context.store.id} currency={currency} from={from} to={to} />}
      {type === 'stock' && <StockReport storeId={context.store.id} currency={currency} from={from} to={to} />}
      {type === 'clients' && <ClientsReport storeId={context.store.id} currency={currency} />}
      {type === 'fournisseurs' && <FournisseursReport storeId={context.store.id} currency={currency} />}
      {type === 'depenses' && <DepensesReport storeId={context.store.id} currency={currency} from={from} to={to} />}
      {type === 'taxes' && <TaxesReport storeId={context.store.id} currency={currency} from={from} to={to} />}
      {type === 'employes' && <EmployesReport storeId={context.store.id} currency={currency} from={from} to={to} />}
    </>
  );
}

function StatutSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink-muted">Statut</span>
      <select
        name="statut"
        defaultValue={defaultValue ?? ''}
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
  );
}

function PaiementSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink-muted">Paiement</span>
      <select
        name="paiement"
        defaultValue={defaultValue ?? ''}
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
  );
}

async function VentesReport({
  storeId,
  currency,
  from,
  to,
  statut,
  paiement,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
  statut?: string;
  paiement?: string;
}) {
  const status = statut && statut in STATUS_LABELS ? statut : undefined;
  const method = paiement && (paiement === 'credit' || paiement in PAYMENT_LABELS) ? paiement : undefined;

  const where: Prisma.SaleWhereInput = {
    storeId,
    createdAt: { gte: from, lte: to },
    ...(status ? { status: status as SaleStatus } : {}),
    ...(method === 'credit' ? { creditAmount: { gt: 0 } } : method ? { payments: { some: { method } } } : {}),
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
        total: true,
        creditAmount: true,
        customer: { select: { name: true } },
        payments: { select: { method: true } },
      },
    }),
    prisma.sale.aggregate({ where, _sum: { total: true, discount: true, taxAmount: true }, _count: true }),
  ]);

  return (
    <>
      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventes" value={String(aggregate._count)} />
        <StatCard label="Chiffre d'affaires" value={formatMoney(aggregate._sum.total ?? 0, currency)} />
        <StatCard label="Remises accordées" value={formatMoney(aggregate._sum.discount ?? 0, currency)} />
        <StatCard label="TVA collectée" value={formatMoney(aggregate._sum.taxAmount ?? 0, currency)} />
      </section>

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
                      <span className="text-state-warn">{sale.payments.length > 0 ? ' + ' : ''}crédit</span>
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
          Affichage limité aux 500 ventes les plus récentes — affinez les filtres pour un rapport plus précis.
        </p>
      )}
    </>
  );
}

async function AchatsReport({
  storeId,
  currency,
  from,
  to,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
}) {
  const { rows, total } = await getPurchasesReport(storeId, from, to);

  return (
    <>
      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Commandes" value={String(rows.length)} />
        <StatCard label="Montant total" value={formatMoney(total, currency)} />
      </section>
      <Card className="overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Fournisseur</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Aucun achat sur cette période.
                </td>
              </tr>
            ) : (
              rows.map((order) => (
                <tr key={order.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-3 font-medium">{order.reference}</td>
                  <td className="px-4 py-3 text-ink-muted">{order.supplierName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={order.status === 'RECEIVED' ? 'success' : 'neutral'}>
                      {PURCHASE_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(order.total, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

async function StockReport({
  storeId,
  currency,
  from,
  to,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
}) {
  const { rows, stockValue } = await getStockMovementsReport(storeId, from, to);

  return (
    <>
      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Mouvements sur la période" value={String(rows.length)} />
        <StatCard label="Valeur actuelle du stock (au coût)" value={formatMoney(stockValue, currency)} />
      </section>
      <Card className="overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Produit</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Variation</th>
              <th className="px-4 py-3 text-right font-medium">Stock après</th>
              <th className="px-4 py-3 font-medium">Motif</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  Aucun mouvement sur cette période.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-3 text-xs text-ink-faint">
                    {m.createdAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">{m.productName}</td>
                  <td className="px-4 py-3 text-ink-muted">{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</td>
                  <td className={`px-4 py-3 text-right font-medium ${m.quantityChange >= 0 ? 'text-state-ok' : 'text-state-bad'}`}>
                    {m.quantityChange >= 0 ? '+' : ''}
                    {formatQty(m.quantityChange)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatQty(m.quantityAfter)}</td>
                  <td className="px-4 py-3 text-ink-faint">{m.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      {rows.length === 500 && (
        <p className="mt-3 text-center text-xs text-ink-faint print:hidden">
          Affichage limité aux 500 mouvements les plus récents — affinez la période pour un rapport plus précis.
        </p>
      )}
    </>
  );
}

async function ClientsReport({ storeId, currency }: { storeId: string; currency: string }) {
  const customers = await getCustomersReport(storeId);

  return (
    <Card className="overflow-x-auto p-0">
      <table className="table-stack w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 text-right font-medium">Ventes</th>
            <th className="px-4 py-3 text-right font-medium">Total dépensé</th>
            <th className="px-4 py-3 text-right font-medium">Solde crédit</th>
            <th className="px-4 py-3 font-medium">Dernière vente</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                Aucun client enregistré.
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr key={customer.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-ink-faint">{customer.phone}</p>
                </td>
                <td className="px-4 py-3 text-right">{customer.salesCount}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(customer.totalSpent, currency)}</td>
                <td className={`px-4 py-3 text-right ${customer.creditBalance > 0 ? 'text-state-warn' : ''}`}>
                  {formatMoney(customer.creditBalance, currency)}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {customer.lastSaleAt
                    ? customer.lastSaleAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

async function FournisseursReport({ storeId, currency }: { storeId: string; currency: string }) {
  const suppliers = await getSuppliersReport(storeId);

  return (
    <Card className="overflow-x-auto p-0">
      <table className="table-stack w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">Fournisseur</th>
            <th className="px-4 py-3 text-right font-medium">Total acheté</th>
            <th className="px-4 py-3 text-right font-medium">Total payé</th>
            <th className="px-4 py-3 text-right font-medium">Dette actuelle</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                Aucun fournisseur enregistré.
              </td>
            </tr>
          ) : (
            suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{supplier.name}</p>
                  {supplier.phone && <p className="text-xs text-ink-faint">{supplier.phone}</p>}
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(supplier.totalPurchased, currency)}</td>
                <td className="px-4 py-3 text-right">{formatMoney(supplier.totalPaid, currency)}</td>
                <td className={`px-4 py-3 text-right font-medium ${supplier.debtBalance > 0 ? 'text-state-warn' : ''}`}>
                  {formatMoney(supplier.debtBalance, currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

async function DepensesReport({
  storeId,
  currency,
  from,
  to,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
}) {
  const { rows, total, byCategory } = await getExpensesReport(storeId, from, to);

  return (
    <>
      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Dépenses" value={String(rows.length)} />
        <StatCard label="Total" value={formatMoney(total, currency)} />
      </section>

      {Object.keys(byCategory).length > 0 && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="text-sm font-medium">Par catégorie</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(byCategory).map(([category, amount]) => (
              <li key={category} className="flex justify-between">
                <span className="text-ink-muted">{EXPENSE_CATEGORY_LABELS[category] ?? category}</span>
                <span className="font-medium">{formatMoney(amount, currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Libellé</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Aucune dépense sur cette période.
                </td>
              </tr>
            ) : (
              rows.map((expense) => (
                <tr key={expense.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-3 text-ink-muted">
                    {expense.incurredAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">{expense.label}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(expense.amount, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

async function TaxesReport({
  storeId,
  currency,
  from,
  to,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
}) {
  const { rows, totalTax } = await getTaxReport(storeId, from, to);

  return (
    <>
      <section aria-label="Résumé" className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Ventes taxées" value={String(rows.length)} />
        <StatCard label="TVA collectée" value={formatMoney(totalTax, currency)} />
      </section>
      <Card className="overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Vente</th>
              <th className="px-4 py-3 text-right font-medium">Sous-total</th>
              <th className="px-4 py-3 text-right font-medium">TVA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                  Aucune vente taxée sur cette période.
                </td>
              </tr>
            ) : (
              rows.map((sale) => (
                <tr key={sale.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">n°{sale.number}</p>
                    <p className="text-xs text-ink-faint">
                      {sale.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(sale.subtotal, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(sale.taxAmount, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

async function EmployesReport({
  storeId,
  currency,
  from,
  to,
}: {
  storeId: string;
  currency: string;
  from: Date;
  to: Date;
}) {
  const employees = await getEmployeesReport(storeId, from, to);

  return (
    <Card className="overflow-x-auto p-0">
      <table className="table-stack w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">Employé</th>
            <th className="px-4 py-3 text-right font-medium">Ventes</th>
            <th className="px-4 py-3 text-right font-medium">Chiffre d&apos;affaires</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                Aucune vente rattachée à un compte sur cette période.
              </td>
            </tr>
          ) : (
            employees.map((employee) => (
              <tr key={employee.userId} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3">{employee.name}</td>
                <td className="px-4 py-3 text-right">{employee.salesCount}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(employee.revenue, currency)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}
