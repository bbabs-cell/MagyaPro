import type { StateTone } from '@/lib/subscription-labels';

/**
 * Pastilles d'état du Super Admin.
 *
 * Elles vivaient dans `src/app/admin/page.tsx`, et quatre écrans les
 * importaient depuis ce fichier de route. Importer un composant depuis une
 * page tire tout son graphe avec lui — les requêtes de la vue d'ensemble, le
 * contrôle d'accès, les métriques — dans des écrans qui n'en ont aucun besoin,
 * et mélange le rendu avec les exports propres au routage (`metadata`,
 * `dynamic`). Elles sont donc ici, où un composant partagé doit être.
 *
 * Le fond du Super Admin est sombre, là où le reste de l'application est clair.
 * Ces pastilles ne peuvent donc pas être celles de `components/ui` : ce sont
 * les mêmes tons, transposés.
 */

const TONE_STYLES: Record<StateTone, string> = {
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-200',
  danger: 'bg-red-500/15 text-red-300',
  info: 'bg-sky-500/15 text-sky-300',
  brand: 'bg-white/15 text-white',
  neutral: 'bg-white/10 text-white/60',
};

export function AdminStateBadge({ label, tone }: { label: string; tone: StateTone }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}
    >
      {label}
    </span>
  );
}

/** État d'un restaurant ou d'une boutique — en ligne, brouillon, suspendu. */
export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, StateTone> = {
    ACTIVE: 'success',
    DRAFT: 'neutral',
    SUSPENDED: 'danger',
  };
  const labels: Record<string, string> = {
    ACTIVE: 'En ligne',
    DRAFT: 'Brouillon',
    SUSPENDED: 'Suspendu',
  };

  return <AdminStateBadge label={labels[status] ?? status} tone={tones[status] ?? 'neutral'} />;
}
