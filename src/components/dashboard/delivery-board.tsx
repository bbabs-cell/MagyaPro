'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { Button, Card } from '@/components/ui';

type DeliveryOrder = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  total: number;
  currency: string;
  placedAt: string;
  statusUpdatedAt: string;
};

const POLL_INTERVAL_MS = 15_000;

function mapsUrl(order: DeliveryOrder): string {
  if (order.deliveryLat !== null && order.deliveryLng !== null) {
    return `https://www.openstreetmap.org/directions?to=${order.deliveryLat},${order.deliveryLng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(order.deliveryAddress ?? '')}`;
}

export function DeliveryBoard({
  initialPool,
  initialMine,
}: {
  initialPool: DeliveryOrder[];
  initialMine: DeliveryOrder[];
}) {
  const [pool, setPool] = useState(initialPool);
  const [mine, setMine] = useState(initialMine);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{ pool: DeliveryOrder[]; mine: DeliveryOrder[] }>('/api/livraisons');
        if (!cancelled) {
          setPool(data.pool);
          setMine(data.mine);
        }
      } catch {
        // Une erreur ponctuelle n'efface pas l'écran : nouvel essai au tour suivant.
      }
      if (!cancelled) timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function claim(order: DeliveryOrder) {
    setPendingId(order.id);
    setError(null);
    try {
      await api.post(`/api/livraisons/${order.id}/prendre`, {});
      setPool((current) => current.filter((o) => o.id !== order.id));
      setMine((current) => [...current, order]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cette livraison n'a pas pu être prise en charge.");
    } finally {
      setPendingId(null);
    }
  }

  async function confirm(order: DeliveryOrder) {
    const code = (codeInputs[order.id] ?? '').trim();
    setPendingId(order.id);
    setError(null);
    try {
      await api.post(`/api/livraisons/${order.id}/livrer`, { code });
      setMine((current) => current.filter((o) => o.id !== order.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La livraison n'a pas pu être confirmée.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">Mes livraisons en cours</h2>
        {mine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-faint">
            Aucune livraison en cours
          </p>
        ) : (
          <div className="space-y-3">
            {mine.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    n°{order.number} · {formatMoney(order.total, order.currency)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{order.customerName}</p>
                {order.deliveryAddress && (
                  <p className="mt-0.5 text-sm text-ink-muted">{order.deliveryAddress}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                  >
                    Appeler
                  </a>
                  <a
                    href={mapsUrl(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                  >
                    Itinéraire
                  </a>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`code-${order.id}`} className="mb-1 block text-xs text-ink-faint">
                      Code de livraison (donné par le client)
                    </label>
                    <input
                      id={`code-${order.id}`}
                      inputMode="numeric"
                      maxLength={6}
                      value={codeInputs[order.id] ?? ''}
                      onChange={(event) =>
                        setCodeInputs((current) => ({ ...current, [order.id]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={pendingId === order.id || (codeInputs[order.id] ?? '').length !== 6}
                    onClick={() => confirm(order)}
                  >
                    Confirmer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Livraisons à prendre</h2>
        {pool.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-faint">
            Rien à prendre pour le moment
          </p>
        ) : (
          <div className="space-y-3">
            {pool.map((order) => (
              <Card key={order.id} className="p-4">
                <p className="font-medium">
                  n°{order.number} · {formatMoney(order.total, order.currency)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{order.customerName}</p>
                {order.deliveryAddress && (
                  <p className="mt-0.5 text-sm text-ink-muted">{order.deliveryAddress}</p>
                )}
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={pendingId === order.id}
                  onClick={() => claim(order)}
                >
                  Prendre cette livraison
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
