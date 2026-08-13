'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { setTableToken } from '@/lib/site/table-session';

export function TableLanding({
  host,
  restaurantId,
  token,
  tableLabel,
  orderingEnabled,
}: {
  host: string;
  restaurantId: string;
  token: string;
  tableLabel: string;
  orderingEnabled: boolean;
}) {
  const [sent, setSent] = useState<'CALL' | 'BILL' | null>(null);
  const [pending, setPending] = useState<'CALL' | 'BILL' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTableToken(restaurantId, token);
  }, [restaurantId, token]);

  async function request(type: 'CALL' | 'BILL') {
    setPending(type);
    setError(null);
    try {
      await api.post(`/api/public/tables/${token}/appel`, { type });
      setSent(type);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La demande n'a pas pu être envoyée.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => request('CALL')}
          className="rounded-2xl border border-surface-border p-5 text-left hover:bg-surface-sunken disabled:opacity-50"
        >
          <p className="font-medium">Appeler le serveur</p>
          <p className="mt-1 text-sm text-ink-muted">
            {sent === 'CALL' ? 'Un serveur a été prévenu.' : 'On arrive à votre table.'}
          </p>
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => request('BILL')}
          className="rounded-2xl border border-surface-border p-5 text-left hover:bg-surface-sunken disabled:opacity-50"
        >
          <p className="font-medium">Demander l&apos;addition</p>
          <p className="mt-1 text-sm text-ink-muted">
            {sent === 'BILL' ? "L'addition arrive." : 'Le restaurant est prévenu.'}
          </p>
        </button>
      </div>

      {orderingEnabled ? (
        <Link
          href={`/r/${host}/menu`}
          className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-6 font-medium text-white hover:bg-ink/90 sm:w-auto"
        >
          Voir la carte et commander pour {tableLabel}
        </Link>
      ) : (
        <p className="text-sm text-ink-muted">
          Consultez le menu au comptoir ou demandez au serveur : la commande
          depuis votre téléphone n&apos;est pas activée pour le moment.
        </p>
      )}
    </div>
  );
}
