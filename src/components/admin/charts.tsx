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
    <div className="rounded-2xl border border-fg/10 p-4">
      <p className="text-xs uppercase tracking-wide text-fg/60">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg/60">{hint}</p>}
    </div>
  );
}

export type BarPoint = { label: string; value: number; display: string };

/**
 * Domaine représenté par un graphique — sa couleur dit de quoi il parle :
 * braise pour Restaurant, or pour Boutique, violet pour les abonnements et la
 * recette de MagyaPro. Jamais une couleur choisie pour décorer.
 */
export type ChartDomain = 'resto' | 'boutique' | 'abo';

export const DOMAIN_BAR: Record<ChartDomain, string> = {
  resto: 'bg-domain-resto/80',
  boutique: 'bg-domain-boutique/80',
  abo: 'bg-domain-abo/80',
};

/**
 * Les barres montent depuis l'axe à l'affichage, l'une après l'autre : le
 * regard suit l'évolution dans l'ordre des mois. Seulement `transform`, coupé
 * pour qui a demandé moins d'animations (règle globale de `globals.css`).
 */
function barDelay(index: number): React.CSSProperties {
  return { animationDelay: `${index * 45}ms` };
}

export function BarChart({ data, max, domain }: { data: BarPoint[]; max: number; domain: ChartDomain }) {
  return (
    <div className="flex h-40 gap-2">
      {data.map((point, index) => (
        // `min-w-0` : la largeur plancher d'une colonne flex est sinon celle
        // de son contenu — ici un montant formaté, qui est long. Les colonnes
        // ne pouvaient pas se comprimer et le graphique poussait la page.
        <div
          key={point.label}
          className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
        >
          <span className="w-full truncate text-center text-[11px] text-fg/60">
            {point.display}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full origin-bottom animate-grow-up rounded-t-md ${point.value > 0 ? DOMAIN_BAR[domain] : 'bg-fg/10'}`}
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%`, ...barDelay(index) }}
              aria-hidden="true"
            />
          </div>
          <span className="w-full truncate text-center text-[11px] text-fg/60">
            {point.label}
          </span>
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
// Première série : Restaurant (braise) ; seconde : Boutique (or). C'est
// l'unique emploi de ce graphique, et la couleur dit le produit sans légende.
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
      <div className="flex items-center gap-4 text-xs text-fg/60">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${DOMAIN_BAR.resto}`} />
          {firstLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${DOMAIN_BAR.boutique}`} />
          {secondLabel}
        </span>
      </div>

      <div className="mt-3 flex h-40 gap-2" aria-hidden="true">
        {data.map((point, index) => (
          <div
            key={point.label}
            className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex w-full flex-1 items-end justify-center gap-0.5">
              <div
                className={`w-1/2 origin-bottom animate-grow-up rounded-t-md ${DOMAIN_BAR.resto}`}
                style={{ height: `${Math.max(2, (point.first / max) * 100)}%`, ...barDelay(index) }}
              />
              <div
                className={`w-1/2 origin-bottom animate-grow-up rounded-t-md ${DOMAIN_BAR.boutique}`}
                style={{ height: `${Math.max(2, (point.second / max) * 100)}%`, ...barDelay(index) }}
              />
            </div>
            <span className="w-full truncate text-center text-[11px] text-fg/60">
              {point.label}
            </span>
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
