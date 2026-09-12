import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { requireStore, listStoreMemberships, setActiveStore } from '@/lib/boutique/store-tenant';
import { getStoreHomeAlerts } from '@/lib/boutique/home-alerts';
import { getStoreDashboardMetrics } from '@/lib/boutique/analytics';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { formatMoney, hasSeveralCurrencies, primaryCurrency, sumByCurrency } from '@/lib/money';
import { Badge, Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Toutes les boutiques' };
export const dynamic = 'force-dynamic';

export default async function ToutesLesBoutiquesPage() {
  const context = await requireStore('store:view');

  const memberships = context.isSupportAccess ? [] : await listStoreMemberships();
  const managed = memberships.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN');

  // Réservée aux comptes qui pilotent plus d'une boutique — sans quoi cette
  // vue n'apporte rien de plus que le tableau de bord habituel.
  if (managed.length < 2) redirect('/boutique/dashboard');

  const rows = await Promise.all(
    managed.map(async (m) => {
      const [metrics, alerts] = await Promise.all([
        getStoreDashboardMetrics(m.store.id, '30d'),
        // Les mêmes alertes que sur la vue d'ensemble de chaque boutique, par
        // la même fonction. Cette page comptait auparavant son « stock bas »
        // autrement : elle incluait les ruptures, que la vue d'ensemble compte
        // à part. Le même commerçant lisait donc deux chiffres différents pour
        // la même chose selon l'écran ouvert.
        getStoreHomeAlerts(m.store.id),
      ]);
      return { ...m, metrics, alerts };
    }),
  );

  // Cumul par devise, jamais entre devises.
  //
  // Ce total additionnait auparavant les recettes de toutes les boutiques sans
  // regarder leur monnaie, puis les affichait dans celle de la première
  // boutique de la liste. Un propriétaire ayant une boutique à Abidjan et une à
  // Douala lisait donc un nombre mêlant deux francs CFA distincts — celui
  // d'Afrique de l'Ouest et celui d'Afrique centrale — étiqueté au hasard de
  // l'ordre d'affichage. De l'argent faux, sans aucun signal.
  const revenueByCurrency = sumByCurrency(
    rows.map((r) => ({ amount: r.metrics.revenue, currency: r.store.currency })),
  );
  const mainCurrency = primaryCurrency(revenueByCurrency);
  const mixedCurrencies = hasSeveralCurrencies(revenueByCurrency);
  const totalSales = rows.reduce((sum, r) => sum + r.metrics.salesCount, 0);

  async function switchAndOpen(storeId: string) {
    'use server';
    await setActiveStore(storeId);
    redirect('/boutique/dashboard');
  }

  return (
    <>
      <PageHeader
        title="Toutes les boutiques"
        description={`Activité des 30 derniers jours sur vos ${rows.length} boutiques.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-ink-muted">Chiffre d&apos;affaires cumulé</p>
          {/* Une ligne par devise. Dans l'immense majorité des cas il n'y en a
              qu'une, et l'affichage est identique à avant. */}
          {Object.entries(revenueByCurrency)
            .sort(([, a], [, b]) => b - a)
            .map(([code, amount]) => (
              <p
                key={code}
                className={
                  code === mainCurrency
                    ? 'mt-1 text-2xl font-semibold text-ink'
                    : 'mt-0.5 text-lg font-semibold text-ink'
                }
              >
                {formatMoney(amount, code)}
              </p>
            ))}
          {Object.keys(revenueByCurrency).length === 0 && (
            <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(0, mainCurrency)}</p>
          )}
          {mixedCurrencies && (
            <p className="mt-2 text-xs text-ink-muted">
              Vos boutiques n&apos;utilisent pas toutes la même monnaie : les
              montants sont présentés séparément plutôt qu&apos;additionnés.
            </p>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-ink-muted">Ventes cumulées</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{totalSales}</p>
        </Card>
      </div>

      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li key={row.store.id}>
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {row.store.name}
                    <Badge tone="neutral">{STORE_ROLE_LABELS[row.role]}</Badge>
                    {row.store.status !== 'ACTIVE' && <Badge tone="warning">{row.store.status}</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatMoney(row.metrics.revenue, row.store.currency)} · {row.metrics.salesCount} vente
                    {row.metrics.salesCount > 1 ? 's' : ''}
                    {row.alerts.outOfStock > 0 && (
                      <span className="text-state-bad">
                        {' '}
                        · {row.alerts.outOfStock} en rupture
                      </span>
                    )}
                    {row.alerts.lowStock > 0 && (
                      <span className="text-state-warn">
                        {' '}
                        · {row.alerts.lowStock} à stock bas
                      </span>
                    )}
                  </p>
                </div>
                <form action={switchAndOpen.bind(null, row.store.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-sunken"
                  >
                    Ouvrir
                  </button>
                </form>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/boutique/dashboard" className="underline underline-offset-4 hover:text-ink">
          Retour au tableau de bord
        </Link>
      </p>
    </>
  );
}
