'use client';

import { useState } from 'react';
import type { PaymentStatus } from '@prisma/client';

import { ApiError, uploadFile } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';

const PROVIDER_LABELS: Record<string, string> = {
  orange_money_manual: 'Orange Money',
  wave_manual: 'Wave',
};

export function PaymentProofUpload({
  orderId,
  provider,
  amount,
  currency,
  receivingNumber,
  status,
  hasProof,
}: {
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  receivingNumber: string;
  status: PaymentStatus;
  hasProof: boolean;
}) {
  const [submitted, setSubmitted] = useState(status === 'PROCESSING' && hasProof);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadFile(`/api/public/commandes/${orderId}/preuve`, formData);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La preuve n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
    }
  }

  if (status === 'PAID') return null;

  const label = PROVIDER_LABELS[provider] ?? provider;

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-sm font-medium text-amber-900">Paiement {label}</h2>
      <p className="mt-1 text-sm text-amber-800">
        Envoyez {formatMoney(amount, currency)} au <span className="font-semibold">{receivingNumber}</span> ({label}
        ), puis déposez votre preuve de paiement ci-dessous.
      </p>

      {submitted ? (
        <p className="mt-3 text-sm font-medium text-amber-900">
          Preuve envoyée — le restaurant va la vérifier.
        </p>
      ) : (
        <div className="mt-3">
          {error && (
            <p role="alert" className="mb-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {status === 'FAILED' && (
            <p className="mb-2 text-sm text-red-800">
              Votre précédente preuve a été refusée. Déposez-en une nouvelle.
            </p>
          )}
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl bg-ink px-5 text-sm font-medium text-surface hover:bg-ink/90">
            {uploading ? 'Envoi…' : 'Déposer la preuve (capture d’écran)'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
