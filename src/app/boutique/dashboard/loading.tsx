import { PageSkeleton } from '@/components/ui/page-skeleton';

/**
 * Affichée par Next.js à l'instant du clic, pendant que la page charge ses
 * données.
 *
 * Elle manquait au tableau de bord Boutique — le Restaurant avait la sienne.
 * Sans elle, un clic dans le menu ne changeait rien à l'écran jusqu'à la
 * réponse complète du serveur : mesuré avec `scripts/audit-clics.mjs`, le
 * premier retour visible arrivait en même temps que la page. Elle permet
 * aussi à Next de précharger la page jusqu'à ce squelette dès que le lien
 * est à l'écran : le clic l'affiche sans attendre le réseau.
 */
export default function BoutiqueDashboardLoading() {
  return <PageSkeleton />;
}
