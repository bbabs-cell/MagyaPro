'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { Card } from '@/components/ui';

type KitchenOrder = {
  id: string;
  number: number;
  status: 'CONFIRMED' | 'PREPARING' | 'READY';
  fulfillmentType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  placedAt: string;
  table: { label: string } | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    options: unknown;
  }>;
};

const POLL_INTERVAL_MS = 12_000;

const COLUMNS: Array<{ status: KitchenOrder['status']; title: string; next: KitchenOrder['status'] | null }> = [
  { status: 'CONFIRMED', title: 'À préparer', next: 'PREPARING' },
  { status: 'PREPARING', title: 'En préparation', next: 'READY' },
  { status: 'READY', title: 'Prêtes', next: null },
];

function elapsedMinutes(placedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(placedAt).getTime()) / 60_000));
}

export function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{ orders: KitchenOrder[] }>('/api/cuisine');
        if (!cancelled) setOrders(data.orders);
      } catch {
        // Une erreur ponctuelle n'efface pas l'écran : on retentera au tour suivant.
      }
      if (!cancelled) timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function advance(order: KitchenOrder, next: KitchenOrder['status']) {
    setPendingId(order.id);
    setError(null);
    try {
      await api.patch(`/api/commandes/${order.id}`, { status: next });
      setOrders((current) =>
        current.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le statut n'a pas pu être mis à jour.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <div key={column.status}>
              <h2 className="mb-2 flex items-center justify-between text-sm font-medium">
                {column.title}
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
                  {columnOrders.length}
                </span>
              </h2>

              <div className="space-y-3">
                {columnOrders.length === 0 && (
                  <p className="rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-faint">
                    Rien ici
                  </p>
                )}

                {columnOrders.map((order) => (
                  <Card key={order.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        n°{order.number}
                        {order.table && ` · ${order.table.label}`}
                      </p>
                      <span className="text-xs text-ink-faint">
                        {elapsedMinutes(order.placedAt)} min
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-sm text-ink-muted">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.productName}
                          {item.variantName && ` (${item.variantName})`}
                        </li>
                      ))}
                    </ul>
                    {column.next && (
                      <button
                        type="button"
                        disabled={pendingId === order.id}
                        onClick={() => advance(order, column.next!)}
                        className="mt-2.5 h-9 w-full rounded-lg bg-ink text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-50"
                      >
                        {column.status === 'CONFIRMED' ? 'Démarrer' : 'Marquer prête'}
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
