import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformAnalytics } from '@/lib/analytics';
import {
  amountIn,
  formatMoney,
  hasSeveralCurrencies,
  mergeByCurrency,
  primaryCurrency,
} from '@/lib/money';
import { BarChart, Metric } from '@/components/admin/charts';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  await requireSuperAdmin();

  const analytics = await getPlatformAnalytics(6);
  const currencies = Object.keys(analytics.mrrByCurrency);
  const maxSignups = Math.max(1, ...analytics.signupsByMonth.map((m) => m.count));
  // Le graphique ne trace qu'une série : elle est libellée dans la devise
  // dominante, et les autres sont énoncées sous le graphique plutôt que
  // fondues dedans. Additionner deux monnaies donnerait un nombre faux.
  const volumeTotals = mergeByCurrency(...analytics.gmvByMonth.map((m) => m.byCurrency));
  const volumeCurrency = primaryCurrency(volumeTotals);
  const gmvSeries = analytics.gmvByMonth.map((m) => ({
    label: m.month,
    amount: amountIn(m.byCurrency, volumeCurrency),
  }));
  const maxGmv = Math.max(1, ...gmvSeries.map((m) => m.amount));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics plateforme</h1>
        <p className="mt-1 text-sm text-white/60">
          Chiffres calculés à partir des données réelles. Aucun historique de
          MRR n&apos;étant conservé mois par mois, seule sa valeur actuelle est
          affichée.
        </p>
      </div>

      <section aria-label="MRR actuel" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {currencies.length === 0 ? (
          <Metric label="MRR actuel" value="—" hint="Aucun abonnement actif." />
        ) : (
          currencies.map((currency) => (
            <Metric
              key={currency}
              label={`MRR (${currency})`}
              value={formatMoney(analytics.mrrByCurrency[currency], currency)}
            />
          ))
        )}
        <Metric
          label="Résiliations (30j)"
          value={String(analytics.churn.cancelledLast30)}
          hint={
            analytics.churn.rate !== null
              ? `${(analytics.churn.rate * 100).toFixed(1)} % des abonnés actifs depuis plus de 30 jours`
              : 'Pas assez de recul pour un taux.'
          }
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="signups">
          <h2 id="signups" className="text-sm font-medium">
            Inscriptions par mois
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <BarChart
              data={analytics.signupsByMonth.map((m) => ({
                label: m.month,
                value: m.count,
                display: String(m.count),
              }))}
              max={maxSignups}
            />
          </div>
        </section>

        <section aria-labelledby="gmv">
          <h2 id="gmv" className="text-sm font-medium">
            Volume de commandes traité par mois
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <BarChart
              data={gmvSeries.map((m) => ({
                label: m.label,
                value: m.amount,
                display: m.amount > 0 ? formatMoney(m.amount, volumeCurrency) : '0',
              }))}
              max={maxGmv}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            Volume brut en {volumeCurrency} — à ne pas confondre avec le revenu
            d&apos;abonnement de MagyaPro.
            {hasSeveralCurrencies(volumeTotals) && (
              <>
                {' '}
                Les autres devises ne sont pas dans le graphique :{' '}
                {Object.keys(volumeTotals)
                  .filter((code) => code !== volumeCurrency && volumeTotals[code] !== 0)
                  .map((code) => formatMoney(volumeTotals[code]!, code))
                  .join(' · ')}
                .
              </>
            )}
          </p>
        </section>
      </div>

      <section aria-labelledby="by-plan" className="mt-8">
        <h2 id="by-plan" className="text-sm font-medium">
          Abonnements actifs par plan
        </h2>
        {analytics.byPlan.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
            Aucun abonnement actif actuellement.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {analytics.byPlan.map((plan) => (
              <li key={plan.planId} className="flex items-center justify-between gap-4 p-3.5 text-sm">
                <span className="font-medium">{plan.planName}</span>
                <span className="text-white/60">
                  {plan.count} abonné{plan.count > 1 ? 's' : ''}
                </span>
                <span className="text-white/40">{formatMoney(plan.mrr, plan.currency)}/mois</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
