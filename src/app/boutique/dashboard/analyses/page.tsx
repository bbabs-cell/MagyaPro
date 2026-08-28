import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { DORMANT_DAYS, TREND_DAYS, getStoreInsights, type MarginRow } from '@/lib/boutique/insights';
import { Badge, Card, EmptyState, PageHeader, StatCard } from '@/components/ui';

export const metadata: Metadata = { title: 'Analyses' };
export const dynamic = 'force-dynamic';

/**
 * Analyses automatiques — ce que les chiffres de la boutique disent d'eux-mêmes.
 *
 * Complémentaire de « Statistiques », qui répond à « combien ai-je vendu ? ».
 * Ici on répond à « où est mon argent, et qu'est-ce qui ne va pas ? » :
 * capital immobilisé, produits qui dorment, marges réelles, ventes à perte.
 *
 * Aucun calcul n'est délégué à un service extérieur : tout vient des ventes
 * et des fiches de la boutique (voir `src/lib/boutique/insights.ts`).
 */
export default async function StoreInsightsPage() {
  const context = await requireStore('analytics:view');
  const insights = await getStoreInsights(context.store.id);
  const currency = context.store.currency;

  const hasSales = insights.revenue.current > 0 || insights.revenue.previous > 0;

  return (
    <>
      <PageHeader
        title="Analyses"
        description={`Lecture automatique de vos données sur ${TREND_DAYS} jours. Aucun chiffre n'est estimé ni simulé.`}
      />

      <section aria-label="Valeur du stock" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Capital immobilisé"
          value={formatMoney(insights.stockValue.cost, currency)}
          hint={`${insights.stockValue.references} référence${insights.stockValue.references > 1 ? 's' : ''} en stock`}
        />
        <StatCard
          label="Valeur au prix de vente"
          value={formatMoney(insights.stockValue.retail, currency)}
          hint="Si tout le stock partait au prix affiché"
        />
        <StatCard
          label="Marge potentielle"
          value={formatMoney(insights.stockValue.potentialMargin, currency)}
          tone={insights.stockValue.potentialMargin > 0 ? 'success' : undefined}
        />
        <StatCard
          label={`Bénéfice — ${TREND_DAYS} jours`}
          value={formatMoney(insights.profit.current, currency)}
          hint={
            insights.profit.change === null
              ? 'Aucune donnée sur la période précédente'
              : `${insights.profit.change > 0 ? '+' : ''}${insights.profit.change} % vs période précédente`
          }
          tone={
            insights.profit.change === null
              ? undefined
              : insights.profit.change >= 0
                ? 'success'
                : 'danger'
          }
        />
      </section>

      {insights.stockValue.missingCost > 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          {insights.stockValue.missingCost} référence
          {insights.stockValue.missingCost > 1 ? 's' : ''} en stock n&apos;
          {insights.stockValue.missingCost > 1 ? 'ont' : 'a'} pas de coût d&apos;achat renseigné —
          {insights.stockValue.missingCost > 1 ? ' elles sont' : ' elle est'} exclue
          {insights.stockValue.missingCost > 1 ? 's' : ''} du capital immobilisé et des marges.
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Tendances sur {TREND_DAYS} jours</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Comparaison avec les {TREND_DAYS} jours précédents, ventes annulées exclues.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <TrendCell
              label="Chiffre d'affaires"
              current={formatMoney(insights.revenue.current, currency)}
              previous={formatMoney(insights.revenue.previous, currency)}
              change={insights.revenue.change}
            />
            <TrendCell
              label="Bénéfice estimé"
              current={formatMoney(insights.profit.current, currency)}
              previous={formatMoney(insights.profit.previous, currency)}
              change={insights.profit.change}
            />
            <TrendCell
              label="Quantités vendues"
              current={String(insights.unitsSold.current)}
              previous={String(insights.unitsSold.previous)}
              change={insights.unitsSold.change}
            />
          </dl>
        </Card>

        {insights.losses.length > 0 ? (
          <Card className="border-state-bad/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">Vendu en dessous du coût d&apos;achat</h2>
              <Badge tone="danger">{insights.losses.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Chaque vente de ces produits vous fait perdre de l&apos;argent. Vérifiez le prix de
              vente ou le coût d&apos;achat enregistré.
            </p>
            <MarginTable rows={insights.losses} currency={currency} />
          </Card>
        ) : null}

        {!hasSales ? (
          <EmptyState
            title="Pas encore assez de ventes"
            description="Les marges et les tendances apparaîtront dès vos premières ventes. Rien n'est simulé en attendant."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">
                {insights.worstMargins.length > 0
                  ? 'Meilleures marges'
                  : 'Marges par produit'}
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Marge calculée au coût d&apos;achat actuel de la fiche.
              </p>
              {insights.bestMargins.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Aucune marge calculable : renseignez le coût d&apos;achat de vos produits.
                </p>
              ) : (
                <MarginTable rows={insights.bestMargins} currency={currency} />
              )}
            </Card>

            {insights.worstMargins.length > 0 ? (
              <Card className="p-4 sm:p-5">
                <h2 className="text-sm font-medium">Marges les plus faibles</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Beaucoup de volume pour peu de bénéfice : à renégocier ou à repositionner.
                </p>
                <MarginTable rows={insights.worstMargins} currency={currency} />
              </Card>
            ) : null}
          </div>
        )}

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Produits dormants</h2>
            {insights.dormantCount > 0 ? (
              <Badge tone="warning">{insights.dormantCount}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            En stock mais sans aucune vente depuis {DORMANT_DAYS} jours. C&apos;est de
            l&apos;argent qui dort en rayon.
          </p>
          {insights.dormant.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              Aucun produit dormant — tout votre stock tourne.
            </p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <caption className="sr-only">
                    Produits en stock sans vente récente, du capital immobilisé le plus élevé au
                    plus faible
                  </caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 font-medium">Produit</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Stock</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Capital</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Dernière vente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.dormant.map((row) => (
                      <tr key={row.variantId} className="border-t border-surface-border">
                        <td className="py-2 pr-2">
                          {row.name}
                          {row.label ? (
                            <span className="text-ink-muted"> · {row.label}</span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.stock}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {formatMoney(row.capital, currency)}
                        </td>
                        <td className="py-2 text-right text-ink-muted">
                          {row.daysSinceSale === null
                            ? 'Jamais vendu'
                            : `il y a ${row.daysSinceSale} j`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {insights.dormantCount > insights.dormant.length ? (
                <p className="mt-3 text-xs text-ink-muted">
                  {insights.dormantCount - insights.dormant.length} autre
                  {insights.dormantCount - insights.dormant.length > 1 ? 's' : ''} référence
                  {insights.dormantCount - insights.dormant.length > 1 ? 's' : ''} dormante
                  {insights.dormantCount - insights.dormant.length > 1 ? 's' : ''} non affichée
                  {insights.dormantCount - insights.dormant.length > 1 ? 's' : ''}.
                </p>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function TrendCell({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: string;
  previous: string;
  change: number | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{current}</dd>
      <dd className="text-xs text-ink-muted">
        {change === null ? (
          <>Période précédente : {previous}</>
        ) : (
          <>
            {change > 0 ? '+' : ''}
            {change} % — précédemment {previous}
          </>
        )}
      </dd>
    </div>
  );
}

function MarginTable({ rows, currency }: { rows: MarginRow[]; currency: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <caption className="sr-only">Marge réalisée par produit sur la période</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
            <th scope="col" className="py-1.5 font-medium">Produit</th>
            <th scope="col" className="py-1.5 text-right font-medium">Qté</th>
            <th scope="col" className="py-1.5 text-right font-medium">Marge</th>
            <th scope="col" className="py-1.5 text-right font-medium">Taux</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.variantId} className="border-t border-surface-border">
              <td className="py-2 pr-2">
                {row.name}
                {row.label ? <span className="text-ink-muted"> · {row.label}</span> : null}
              </td>
              <td className="py-2 text-right tabular-nums">{row.quantity}</td>
              <td
                className={`py-2 text-right font-medium tabular-nums ${
                  row.margin < 0 ? 'text-state-bad' : ''
                }`}
              >
                {formatMoney(row.margin, currency)}
              </td>
              <td className="py-2 text-right tabular-nums">{row.marginRate} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
