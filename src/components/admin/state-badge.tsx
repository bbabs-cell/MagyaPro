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
 * Le Super Admin a son propre thème (sombre ou clair, voir `theme-root.tsx`) :
 * ces pastilles lisent ses jetons — `state-*` pour les états, `fg` pour le
 * neutre — et restent lisibles dans les deux.
 */

const TONE_STYLES: Record<StateTone, string> = {
  success: 'bg-emerald-500/15 text-state-ok',
  warning: 'bg-amber-500/15 text-state-warn',
  danger: 'bg-red-500/15 text-state-bad',
  // `info` ne sert ici qu'à l'essai gratuit : un état d'abonnement, donc la
  // couleur des abonnements plutôt qu'un bleu qui désigne les utilisateurs.
  info: 'bg-domain-abo/15 text-domain-abo',
  brand: 'bg-fg/15 text-fg',
  neutral: 'bg-fg/10 text-fg/60',
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
