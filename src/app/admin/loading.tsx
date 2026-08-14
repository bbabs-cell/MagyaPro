import { SkeletonRows } from '@/components/ui';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
      <SkeletonRows rows={6} />
    </div>
  );
}
