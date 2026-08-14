'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button } from '@/components/ui';

export function PaymentVerifyButtons({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(status: 'PAID' | 'FAILED') {
    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/paiements/${paymentId}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La vérification n'a pas pu être enregistrée.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      {error && <p className="mb-1.5 text-xs text-red-600">{error}</p>}
      <div className="flex gap-1.5">
        <Button size="sm" disabled={pending} onClick={() => verify('PAID')}>
          Valider le paiement
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => verify('FAILED')}>
          Rejeter
        </Button>
      </div>
    </div>
  );
}
