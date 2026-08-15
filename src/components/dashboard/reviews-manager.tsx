'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, EmptyState, cx } from '@/components/ui';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  orderNumber: number | null;
};

const FILTERS: Array<{ key: ReviewStatus | 'ALL'; label: string }> = [
  { key: 'PENDING', label: 'En attente' },
  { key: 'APPROVED', label: 'Approuvés' },
  { key: 'REJECTED', label: 'Rejetés' },
  { key: 'ALL', label: 'Tous' },
];

const STATUS_TONE: Record<ReviewStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} sur 5 étoiles`} className="text-amber-500">
      {'★'.repeat(rating)}
      <span className="text-surface-border">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewsManager({
  reviews,
  canModerate,
}: {
  reviews: Review[];
  canModerate: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ReviewStatus | 'ALL'>('PENDING');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approved = reviews.filter((review) => review.status === 'APPROVED');
  const averageRating = useMemo(() => {
    if (approved.length === 0) return null;
    return approved.reduce((sum, review) => sum + review.rating, 0) / approved.length;
  }, [approved]);

  const visible = filter === 'ALL' ? reviews : reviews.filter((r) => r.status === filter);

  async function moderate(review: Review, status: 'APPROVED' | 'REJECTED') {
    setPendingId(review.id);
    setError(null);
    try {
      await api.patch(`/api/avis/${review.id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'avis n'a pas pu être modéré.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {averageRating !== null && (
        <Card className="mb-6 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Note moyenne
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              {averageRating.toFixed(1)}
            </span>
            <Stars rating={Math.round(averageRating)} />
            <span className="text-sm text-ink-muted">
              sur {approved.length} avis publié{approved.length > 1 ? 's' : ''}
            </span>
          </p>
        </Card>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm',
              filter === item.key
                ? 'border-brand bg-brand text-white'
                : 'border-surface-border text-ink-muted hover:bg-surface-sunken',
            )}
          >
            {item.label}
            {item.key === 'PENDING' &&
              reviews.filter((r) => r.status === 'PENDING').length > 0 &&
              ` (${reviews.filter((r) => r.status === 'PENDING').length})`}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        {visible.length === 0 ? (
          <EmptyState
            title="Aucun avis"
            description="Les avis laissés par vos clients depuis votre site public apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-surface-border">
            {visible.map((review) => (
              <li key={review.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{review.customerName}</span>
                  <Stars rating={review.rating} />
                  <Badge tone={STATUS_TONE[review.status]}>
                    {STATUS_LABEL[review.status]}
                  </Badge>
                  {review.orderNumber && (
                    <span className="text-xs text-ink-faint">
                      Commande n°{review.orderNumber}
                    </span>
                  )}
                </div>
                {review.comment && (
                  <p className="mt-1.5 text-sm text-ink-muted">{review.comment}</p>
                )}
                <p className="mt-1 text-xs text-ink-faint">
                  {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>

                {canModerate && review.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={pendingId === review.id}
                      onClick={() => moderate(review, 'APPROVED')}
                    >
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === review.id}
                      onClick={() => moderate(review, 'REJECTED')}
                    >
                      Rejeter
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
