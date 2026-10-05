import { PageSkeleton } from '@/components/ui/page-skeleton';

/**
 * Affichée immédiatement par Next.js pendant qu'une page du dashboard charge
 * ses données — sans elle, un clic reste visuellement sans effet jusqu'à la
 * fin du chargement, ce qui se lit comme un blocage.
 */
export default function DashboardLoading() {
  return <PageSkeleton />;
}
