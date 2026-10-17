'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

const PROVIDER_LABELS: Record<string, string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

export function SubscriptionPaymentReview({
  paymentId,
  restaurantName,
  planName,
  amountLabel,
  provider,
  country,
  proofImageUrl,
  submittedLabel,
}: {
  paymentId: string;
  restaurantName: string;
  planName: string;
  amountLabel: string;
  provider: string;
  country: string | null;
  proofImageUrl: string | null;
  submittedLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!window.confirm(`Confirmer la réception de ${amountLabel} de « ${restaurantName} » ?`)) return;
    setPending('approve');
    setError(null);
    try {
      await api.post(`/api/admin/abonnements/${paymentId}/approuver`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'approbation a échoué.");
      setPending(null);
    }
  }

  async function reject() {
    const note = window.prompt('Motif du refus (optionnel) :') ?? undefined;
    setPending('reject');
    setError(null);
    try {
      await api.post(`/api/admin/abonnements/${paymentId}/refuser`, { note });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le refus a échoué.');
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-fg/10 bg-fg/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{restaurantName}</p>
          <p className="mt-0.5 text-sm text-fg/60">
            {planName} · {amountLabel} · {PROVIDER_LABELS[provider] ?? provider}
            {country && <> · {country}</>}
          </p>
          <p className="mt-0.5 text-xs text-fg/60">Déposé {submittedLabel}</p>
        </div>

        {proofImageUrl ? (
          <a
            href={proofImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 overflow-hidden rounded-lg border border-fg/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- preuve déposée par le tenant */}
            <img src={proofImageUrl} alt="Preuve de paiement" className="h-20 w-20 object-cover" />
          </a>
        ) : (
          <span className="shrink-0 rounded-lg border border-dashed border-fg/20 px-3 py-1.5 text-xs text-fg/60">
            Aucune preuve déposée
          </span>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-xs text-state-bad">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={approve}
          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-state-ok hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {pending === 'approve' ? 'Validation…' : 'Approuver'}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={reject}
          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-state-bad hover:bg-red-500/30 disabled:opacity-50"
        >
          {pending === 'reject' ? 'Refus…' : 'Refuser'}
        </button>
      </div>
    </div>
  );
}
