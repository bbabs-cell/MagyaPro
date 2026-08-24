import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformStoreAnalytics } from '@/lib/boutique/platform-analytics';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Analytics Boutique' };
export const dynamic = 'force-dynamic';

export default async function AdminStoreAnalyticsPage() {
  await requireSuperAdmin();

  const analytics = await getPlatformStoreAnalytics(6);
  const currencies = Object.keys(analytics.mrrByCurrency);
  const maxSignups = Math.max(1, ...analytics.signupsByMonth.map((m) => m.count));
  const maxGmv = Math.max(1, ...analytics.gmvByMonth.map((m) => m.amount));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics Boutique</h1>
        <p className="mt-1 text-sm text-white/60">
          Équivalent de « Analytics » pour MagyaPro Boutique — chiffres calculés à partir des
          ventes et abonnements Boutique réels, boutiques de démonstration exclues.
        </p>
      </div>

      <section aria-label="MRR actuel" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {currencies.length === 0 ? (
          <Metric label="MRR actuel" value="—" hint="Aucun abonnement actif." />
        ) : (
          currencies.map((currency) => (
            <Metric key={currency} label={`MRR (${currency})`} value={formatMoney(analytics.mrrByCurrency[currency], currency)} />
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
          <h2 id="signups" className="text-sm font-medium">Nouvelles boutiques par mois</h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <BarChart
              data={analytics.signupsByMonth.map((m) => ({ label: m.month, value: m.count, display: String(m.count) }))}
              max={maxSignups}
            />
          </div>
        </section>

        <section aria-labelledby="gmv">
          <h2 id="gmv" className="text-sm font-medium">Volume de ventes traité par mois</h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <BarChart
              data={analytics.gmvByMonth.map((m) => ({ label: m.month, value: m.amount, display: m.amount > 0 ? formatMoney(m.amount, 'XOF') : '0' }))}
              max={maxGmv}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            Volume brut, toutes devises confondues affichées en XOF — à ne pas confondre avec le
            revenu d&apos;abonnement de Magyapro.
          </p>
        </section>
      </div>

      <section aria-labelledby="by-plan" className="mt-8">
        <h2 id="by-plan" className="text-sm font-medium">Abonnements Boutique actifs par plan</h2>
        {analytics.byPlan.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">Aucun abonnement actif actuellement.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {analytics.byPlan.map((plan) => (
              <li key={plan.planId} className="flex items-center justify-between gap-4 p-3.5 text-sm">
                <span className="font-medium">{plan.planName}</span>
                <span className="text-white/60">{plan.count} abonné{plan.count > 1 ? 's' : ''}</span>
                <span className="text-white/40">{formatMoney(plan.mrr, plan.currency)}/mois</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function BarChart({ data, max }: { data: Array<{ label: string; value: number; display: string }>; max: number }) {
  return (
    <div className="flex h-40 gap-2">
      {data.map((point) => (
        <div key={point.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] text-white/50">{point.display}</span>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-md bg-white/80" style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }} aria-hidden="true" />
          </div>
          <span className="text-[11px] text-white/40">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
