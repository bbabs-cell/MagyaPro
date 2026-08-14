import { SkeletonRows } from '@/components/ui';

/**
 * Affichée immédiatement par Next.js pendant qu'une page du dashboard charge
 * ses données — sans elle, un clic reste visuellement sans effet jusqu'à la
 * fin du chargement, ce qui se lit comme un blocage.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-sunken" />
      <SkeletonRows rows={6} />
    </div>
  );
}
