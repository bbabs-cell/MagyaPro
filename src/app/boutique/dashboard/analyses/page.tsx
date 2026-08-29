import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { DORMANT_DAYS, TREND_DAYS, getStoreInsights, type MarginRow } from '@/lib/boutique/insights';
import { Badge, Card, EmptyState, PageHeader, StatCard, cx } from '@/components/ui';

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
 *
 * Ordre de lecture, du plus urgent au plus contextuel : ce qui coûte de
 * l'argent maintenant, puis où l'argent est immobilisé, puis les tendances,
 * puis les classements. Une page d'analyse qui commence par des totaux oblige
 * à tout lire avant de savoir s'il y a un problème.
 */
export default async function StoreInsightsPage() {
  const context = await requireStore('analytics:view');
  const insights = await getStoreInsights(context.store.id);
  const currency = context.store.currency;

  const hasSales = insights.revenue.current > 0 || insights.revenue.previous > 0;

  // Ce qui mérite une action, formulé en une ligne chacun. Une page sans
  // hiérarchie oblige le commerçant à décider lui-même par quoi commencer.
  const alerts: Array<{ tone: 'danger' | 'warning'; text: string }> = [];
  if (insights.losses.length > 0) {
    alerts.push({
      tone: 'danger',
      text: `${insights.losses.length} produit${insights.losses.length > 1 ? 's sont vendus' : ' est vendu'} en dessous de son coût d'achat.`,
    });
  }
  if (insights.dormantCapital > 0) {
    alerts.push({
      tone: 'warning',
      text: `${formatMoney(insights.dormantCapital, currency)} dorment sur ${insights.dormantCount} référence${insights.dormantCount > 1 ? 's' : ''} sans vente depuis ${DORMANT_DAYS} jours.`,
    });
  }
  if (insights.stockValue.missingCost > 0) {
    alerts.push({
      tone: 'warning',
      text: `${insights.stockValue.missingCost} référence${insights.stockValue.missingCost > 1 ? 's en stock n’ont' : ' en stock n’a'} pas de coût d'achat renseigné — ${insights.stockValue.missingCost > 1 ? 'elles sont exclues' : 'elle est exclue'} du capital et des marges.`,
    });
  }

  return (
    <>
      <PageHeader
        title="Analyses"
        description={`Lecture automatique de vos données sur ${TREND_DAYS} jours. Aucun chiffre n'est estimé ni simulé.`}
      />

      {/* --- 1. Ce qui demande une action --------------------------------- */}
      {alerts.length > 0 ? (
        <section aria-label="À traiter en priorité" className="mb-6">
          <h2 className="text-sm font-medium">À traiter en priorité</h2>
          <ul className="mt-2 space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.text}
                className={cx(
                  'flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm',
                  alert.tone === 'danger'
                    ? 'bg-state-bad-soft text-state-bad'
                    : 'bg-state-warn-soft text-state-warn',
                )}
              >
                {/* Une icône en plus de la couleur : la couleur seule exclut
                    ceux qui la distinguent mal et disparaît à l'impression. */}
                <span aria-hidden="true" className="mt-px font-semibold">
                  {alert.tone === 'danger' ? '✕' : '!'}
                </span>
                <span>{alert.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mb-6 rounded-xl bg-state-ok-soft px-3.5 py-2.5 text-sm text-state-ok">
          <span aria-hidden="true">✓</span> Rien d&apos;anormal : aucune vente à perte, aucun stock
          dormant, tous vos coûts d&apos;achat sont renseignés.
        </p>
      )}

      {/* --- 2. Où est l'argent -------------------------------------------- */}
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

      <div className="mt-6 space-y-6">
        {/* --- 3. Ventes à perte ------------------------------------------- */}
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

        {/* --- 4. Tendances ------------------------------------------------ */}
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

        {/* --- 5. Marges --------------------------------------------------- */}
        {!hasSales ? (
          <EmptyState
            title="Pas encore assez de ventes"
            description="Les marges et les tendances apparaîtront dès vos premières ventes. Rien n'est simulé en attendant."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">
                {insights.worstMargins.length > 0 ? 'Meilleures marges' : 'Marges par produit'}
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

        {/* --- 6. Dormants -------------------------------------------------- */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Produits dormants</h2>
            {insights.dormantCount > 0 ? (
              <Badge tone="warning">{insights.dormantCount}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            En stock mais sans aucune vente depuis {DORMANT_DAYS} jours. C&apos;est de l&apos;argent
            qui dort en rayon.
          </p>
          {insights.dormant.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              Aucun produit dormant — tout votre stock tourne.
            </p>
          ) : (
            <>
              {/*
                `table-stack` : la table se replie en cartes empilées sous
                640 px, comme partout ailleurs dans l'application. Cet écran
                était le seul à imposer un défilement horizontal pour lire un
                chiffre sur téléphone.
              */}
              <table className="table-stack mt-4 w-full text-sm">
                <caption className="sr-only">
                  Produits en stock sans vente récente, du capital immobilisé le plus élevé au plus
                  faible
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
                      <td data-label="Produit" className="py-2 pr-2 text-left font-medium">
                        {row.name}
                        {row.label ? <span className="text-ink-muted"> · {row.label}</span> : null}
                      </td>
                      <td data-label="Stock" className="py-2 text-right tabular-nums">
                        {row.stock}
                      </td>
                      <td data-label="Capital" className="py-2 text-right font-medium tabular-nums">
                        {formatMoney(row.capital, currency)}
                      </td>
                      <td data-label="Dernière vente" className="py-2 text-right text-ink-muted">
                        {row.daysSinceSale === null
                          ? 'Jamais vendu'
                          : `il y a ${row.daysSinceSale} j`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  const rising = change !== null && change > 0;
  const falling = change !== null && change < 0;

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{current}</dd>
      <dd className="mt-0.5 text-xs">
        {change === null ? (
          <span className="text-ink-muted">Période précédente : {previous}</span>
        ) : (
          <>
            {/* Flèche + signe + couleur : trois signaux pour la même
                information, aucun ne dépendant seul de la vue des couleurs. */}
            <span
              className={cx(
                'font-medium',
                rising && 'text-state-ok',
                falling && 'text-state-bad',
                !rising && !falling && 'text-ink-muted',
              )}
            >
              <span aria-hidden="true">{rising ? '▲' : falling ? '▼' : '='}</span> {change > 0 ? '+' : ''}
              {change} %
            </span>
            <span className="text-ink-muted"> — précédemment {previous}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function MarginTable({ rows, currency }: { rows: MarginRow[]; currency: string }) {
  // Échelle commune à toutes les lignes du tableau : sans elle, deux barres
  // de même longueur pourraient représenter 12 % et 80 %.
  const scale = Math.max(...rows.map((row) => Math.abs(row.marginRate)), 1);

  return (
    <table className="table-stack mt-4 w-full text-sm">
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
            <td data-label="Produit" className="py-2 pr-2 text-left">
              {row.name}
              {row.label ? <span className="text-ink-muted"> · {row.label}</span> : null}
            </td>
            <td data-label="Qté" className="py-2 text-right tabular-nums">
              {row.quantity}
            </td>
            <td
              data-label="Marge"
              className={cx(
                'py-2 text-right font-medium tabular-nums',
                row.margin < 0 && 'text-state-bad',
              )}
            >
              {formatMoney(row.margin, currency)}
            </td>
            <td data-label="Taux" className="py-2 text-right">
              <span className="inline-flex items-center justify-end gap-2">
                {/* La barre rend les taux comparables d'un coup d'œil ; le
                    nombre reste la source exacte, la barre ne fait que le
                    doubler visuellement. */}
                <span
                  aria-hidden="true"
                  // `md` et non `sm` : c'est à 768 px que `table-stack` repasse en
                  // vraie table (voir `globals.css`). Aligner la barre sur ce
                  // même seuil évite qu'elle apparaisse dans une fiche empilée.
                  className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken md:block"
                >
                  <span
                    className={cx(
                      'block h-full rounded-full',
                      row.margin < 0 ? 'bg-state-bad' : 'bg-state-ok',
                    )}
                    style={{ width: `${Math.min(100, (Math.abs(row.marginRate) / scale) * 100)}%` }}
                  />
                </span>
                <span className="tabular-nums">{row.marginRate} %</span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
