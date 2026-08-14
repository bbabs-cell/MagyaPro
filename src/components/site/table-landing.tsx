'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { setTableToken } from '@/lib/site/table-session';
import { useI18n } from '@/components/site/i18n-provider';

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
  const { dict } = useI18n();

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
      setError(err instanceof ApiError ? err.message : dict.table.error);
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
          <p className="font-medium">{dict.table.callServer}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {sent === 'CALL' ? dict.table.callSent : dict.table.callHint}
          </p>
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => request('BILL')}
          className="rounded-2xl border border-surface-border p-5 text-left hover:bg-surface-sunken disabled:opacity-50"
        >
          <p className="font-medium">{dict.table.requestBill}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {sent === 'BILL' ? dict.table.billSent : dict.table.billHint}
          </p>
        </button>
      </div>

      {orderingEnabled ? (
        <Link
          href={`/r/${host}/menu`}
          className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-6 font-medium text-white hover:bg-ink/90 sm:w-auto"
        >
          {dict.table.seeMenuFor(tableLabel)}
        </Link>
      ) : (
        <p className="text-sm text-ink-muted">{dict.table.orderingDisabled}</p>
      )}
    </div>
  );
}
