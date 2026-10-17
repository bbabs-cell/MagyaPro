'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { paymentReference } from '@/lib/boutique/subscription-reference';

/**
 * Copie de `subscription-payment-review.tsx` (Restaurant) pointant vers les
 * routes `/api/admin/boutique-abonnements` — fichier distinct pour ne jamais
 * mélanger les deux points d'accès réseau.
 */

const PROVIDER_LABELS: Record<string, string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

export function StoreSubscriptionPaymentReview({
  paymentId,
  storeName,
  planName,
  amountLabel,
  provider,
  country,
  proofImageUrl,
  submittedLabel,
  billingNote,
}: {
  paymentId: string;
  storeName: string;
  planName: string;
  amountLabel: string;
  provider: string;
  country: string | null;
  proofImageUrl: string | null;
  submittedLabel: string;
  /**
   * Explication du montant quand il ne correspond pas au tarif affiché du
   * plan. Sans elle, on valide un versement de 18 750 pour un plan à 25 000
   * sans savoir si c'est normal ou si le commerçant a payé de travers.
   */
  billingNote?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!window.confirm(`Confirmer la réception de ${amountLabel} de « ${storeName} » ?`)) return;
    setPending('approve');
    setError(null);
    try {
      await api.post(`/api/admin/boutique-abonnements/${paymentId}/approuver`);
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
      await api.post(`/api/admin/boutique-abonnements/${paymentId}/refuser`, { note });
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
          <p className="font-medium">{storeName}</p>
          <p className="mt-0.5 text-sm text-fg/60">
            {planName} · {amountLabel} · {PROVIDER_LABELS[provider] ?? provider}
            {country && <> · {country}</>}
          </p>
          {billingNote && (
            <p className="mt-1 inline-block rounded-md bg-amber-400/10 px-2 py-0.5 text-xs text-state-warn">
              {billingNote}
            </p>
          )}
          <p className="mt-0.5 text-xs text-fg/60">
            Déposé {submittedLabel} · référence{' '}
            {/* Celle que le commerçant met dans le motif de son envoi. */}
            <span className="font-mono text-fg/70">{paymentReference(paymentId)}</span>
          </p>
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
