/**
 * Graphiques du Super Admin — sans dépendance, rendus côté serveur.
 *
 * `Metric` et `BarChart` étaient recopiés à l'identique dans les deux écrans
 * de statistiques. Ils vivent ici, avec `GroupedBarChart` qui manquait : tant
 * qu'on ne peut pas superposer Restaurant et Boutique sur le même axe, les
 * comparer demande d'ouvrir deux pages et de retenir des chiffres.
 *
 * Des `div` dont la hauteur est proportionnelle plutôt qu'une bibliothèque :
 * aucun script à charger, aucun scintillement au chargement, et la page reste
 * lisible sur une connexion lente.
 */

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

export type BarPoint = { label: string; value: number; display: string };

export function BarChart({ data, max }: { data: BarPoint[]; max: number }) {
  return (
    <div className="flex h-40 gap-2">
      {data.map((point) => (
        <div key={point.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] text-white/50">{point.display}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-white/80"
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
              aria-hidden="true"
            />
          </div>
          <span className="text-[11px] text-white/40">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export type GroupedPoint = { label: string; first: number; second: number };

/**
 * Deux séries côte à côte sur un axe commun.
 *
 * L'échelle est partagée par les deux séries — c'est tout l'intérêt : si les
 * boutiques pèsent le quart des restaurants, la barre doit être quatre fois
 * plus courte. Deux échelles indépendantes donneraient deux barres de même
 * hauteur et suggéreraient une parité qui n'existe pas.
 *
 * Le tableau sous le graphique n'est pas décoratif : il porte les mêmes
 * chiffres en toutes lettres pour qui lit la page avec un lecteur d'écran, où
 * des hauteurs de rectangles ne disent rien.
 */
export function GroupedBarChart({
  data,
  format,
  firstLabel,
  secondLabel,
}: {
  data: GroupedPoint[];
  /** Mise en forme d'une valeur — un nombre brut, ou un montant. */
  format: (value: number) => string;
  firstLabel: string;
  secondLabel: string;
}) {
  const max = Math.max(1, ...data.flatMap((point) => [point.first, point.second]));

  return (
    <>
      <div className="flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-white/80" />
          {firstLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-emerald-400/80" />
          {secondLabel}
        </span>
      </div>

      <div className="mt-3 flex h-40 gap-2" aria-hidden="true">
        {data.map((point) => (
          <div key={point.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t-md bg-white/80"
                style={{ height: `${Math.max(2, (point.first / max) * 100)}%` }}
              />
              <div
                className="w-1/2 rounded-t-md bg-emerald-400/80"
                style={{ height: `${Math.max(2, (point.second / max) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-white/40">{point.label}</span>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>
          {firstLabel} et {secondLabel}, par mois
        </caption>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">{firstLabel}</th>
            <th scope="col">{secondLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{format(point.first)}</td>
              <td>{format(point.second)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
