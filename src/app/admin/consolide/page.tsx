import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformAnalytics } from '@/lib/analytics';
import { getPlatformStoreAnalytics } from '@/lib/boutique/platform-analytics';
import { amountIn, getPlatformRevenue, primaryCurrency } from '@/lib/platform-revenue';
import { formatMoney } from '@/lib/money';
import { BarChart, GroupedBarChart, Metric } from '@/components/admin/charts';

export const metadata: Metadata = { title: 'Vue consolidée' };
export const dynamic = 'force-dynamic';

const MONTHS = 6;

/**
 * Vue consolidée — les deux produits sur les mêmes axes.
 *
 * Les statistiques n'existaient que par produit, sur deux pages jumelles.
 * Répondre à « est-ce que Boutique décolle par rapport à Restaurant » demandait
 * d'ouvrir les deux et de retenir des chiffres de tête, ce que personne ne fait
 * correctement.
 *
 * La page distingue deux natures de chiffres, et le dit :
 *
 * — la **recette**, l'argent réellement encaissé (paiements d'abonnement
 *   validés). C'est un fait ;
 * — le **MRR**, prix des plans multiplié par le nombre d'abonnements actifs.
 *   C'est une projection, qui suppose que tout le monde paie et paie à l'heure.
 *
 * Les confondre fait prendre une prévision pour un relevé de compte. Elles sont
 * donc dans deux sections séparées, chacune avec sa mise en garde.
 */
export default async function AdminConsolidatedPage() {
  await requireSuperAdmin();

  const [restaurant, store, revenue] = await Promise.all([
    getPlatformAnalytics(MONTHS),
    getPlatformStoreAnalytics(MONTHS),
    getPlatformRevenue(MONTHS),
  ]);

  const currency = primaryCurrency(revenue.allTime);
  const thisMonth = amountIn(revenue.currentMonth, currency);

  // MRR des deux produits, additionné devise par devise — jamais entre devises.
  const mrrCurrencies = [
    ...new Set([...Object.keys(restaurant.mrrByCurrency), ...Object.keys(store.mrrByCurrency)]),
  ];

  const cancelled = restaurant.churn.cancelledLast30 + store.churn.cancelledLast30;
  const activeBefore = restaurant.churn.activeAtPeriodStart + store.churn.activeAtPeriodStart;

  // Les deux produits produisent la même liste de mois, dans le même ordre :
  // ils partagent la fenêtre et le même calcul de libellé.
  const signups = restaurant.signupsByMonth.map((point, index) => ({
    label: point.month,
    first: point.count,
    second: store.signupsByMonth[index]?.count ?? 0,
  }));
  const volumes = restaurant.gmvByMonth.map((point, index) => ({
    label: point.month,
    first: point.amount,
    second: store.gmvByMonth[index]?.amount ?? 0,
  }));

  const allPlans = [...restaurant.byPlan, ...store.byPlan].sort((a, b) => b.mrr - a.mrr);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vue consolidée</h1>
        <p className="mt-1 text-sm text-white/60">
          Restaurant et Boutique sur les mêmes axes, sur {MONTHS} mois. Les
          restaurants et boutiques de démonstration sont exclus partout.
        </p>
      </div>

      <section aria-labelledby="recette" className="mt-8">
        <h2 id="recette" className="text-sm font-medium">
          Recette encaissée
        </h2>
        <p className="mt-1 text-xs text-white/40">
          Paiements d&apos;abonnement dont vous avez validé la preuve. C&apos;est
          de l&apos;argent constaté reçu, pas une prévision.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ce mois-ci" value={formatMoney(thisMonth, currency)} />
          {/* Le mois précédent en entier : cette carte donne un total, elle ne
              compare rien, donc pas de troncature au quantième du jour. */}
          <Metric
            label="Mois dernier"
            value={formatMoney(amountIn(revenue.previousMonthFull, currency), currency)}
          />
          <Metric
            label="Restaurant (ce mois)"
            value={formatMoney(amountIn(revenue.currentMonthByProduct.restaurant, currency), currency)}
          />
          <Metric
            label="Boutique (ce mois)"
            value={formatMoney(amountIn(revenue.currentMonthByProduct.store, currency), currency)}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 p-4">
          <BarChart
            data={revenue.byMonth.slice(-MONTHS).map((point) => {
              const amount = amountIn(point.byCurrency, currency);
              return {
                label: point.month,
                value: amount,
                display: amount > 0 ? formatMoney(amount, currency) : '0',
              };
            })}
            max={Math.max(
              1,
              ...revenue.byMonth.slice(-MONTHS).map((point) => amountIn(point.byCurrency, currency)),
            )}
          />
        </div>
      </section>

      <section aria-labelledby="mrr" className="mt-10">
        <h2 id="mrr" className="text-sm font-medium">
          Revenu récurrent projeté
        </h2>
        <p className="mt-1 text-xs text-white/40">
          Prix des plans multiplié par le nombre d&apos;abonnements actifs — ce
          que rapporterait un mois où tout le monde paie à l&apos;heure. À
          comparer à la recette réelle ci-dessus : l&apos;écart, ce sont les
          impayés.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mrrCurrencies.length === 0 ? (
            <Metric label="MRR" value="—" hint="Aucun abonnement actif." />
          ) : (
            mrrCurrencies.map((code) => (
              <Metric
                key={code}
                label={`MRR total (${code})`}
                value={formatMoney(
                  (restaurant.mrrByCurrency[code] ?? 0) + (store.mrrByCurrency[code] ?? 0),
                  code,
                )}
                hint={`Restaurant ${formatMoney(restaurant.mrrByCurrency[code] ?? 0, code)} · Boutique ${formatMoney(store.mrrByCurrency[code] ?? 0, code)}`}
              />
            ))
          )}
          <Metric
            label="Résiliations (30 j)"
            value={String(cancelled)}
            hint={
              activeBefore > 0
                ? `${((cancelled / activeBefore) * 100).toFixed(1)} % des abonnés de plus de 30 jours, les deux produits confondus`
                : 'Pas assez de recul pour un taux.'
            }
          />
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="inscriptions">
          <h2 id="inscriptions" className="text-sm font-medium">
            Nouveaux comptes par mois
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <GroupedBarChart
              data={signups}
              format={(value) => String(value)}
              firstLabel="Restaurants"
              secondLabel="Boutiques"
            />
          </div>
        </section>

        <section aria-labelledby="volumes">
          <h2 id="volumes" className="text-sm font-medium">
            Volume traité par mois
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <GroupedBarChart
              data={volumes}
              format={(value) => formatMoney(value, currency)}
              firstLabel="Commandes"
              secondLabel="Ventes"
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            L&apos;argent qui passe dans les caisses de vos clients, pas le
            vôtre.
          </p>
        </section>
      </div>

      <section aria-labelledby="plans" className="mt-10">
        <h2 id="plans" className="text-sm font-medium">
          Abonnements actifs par plan, tous produits
        </h2>
        {allPlans.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
            Aucun abonnement actif actuellement.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {allPlans.map((plan) => (
              <li
                key={plan.planId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3.5 text-sm"
              >
                <span className="font-medium">{plan.planName}</span>
                <span className="text-white/60">
                  {plan.count} abonné{plan.count > 1 ? 's' : ''}
                </span>
                <span className="text-white/40">{formatMoney(plan.mrr, plan.currency)}/mois</span>
              </li>
            ))}
          </ul>
        )}
        {/* Les deux produits ont des plans qui portent le même nom — « Premium »
            existe des deux côtés à des tarifs différents. Sans le tarif affiché
            à côté, deux lignes identiques seraient indiscernables. */}
        <p className="mt-2 text-xs text-white/40">
          Les deux produits ont des plans homonymes ; le montant mensuel les
          distingue.
        </p>
      </section>
    </>
  );
}
