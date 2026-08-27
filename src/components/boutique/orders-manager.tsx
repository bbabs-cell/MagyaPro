'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { formatQty } from '@/lib/boutique/quantity';
import { Badge, Card, cx } from '@/components/ui';

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Order = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELLED';
  total: number;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_LABELS: Record<Order['status'], string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête pour retrait',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const STATUS_TONES: Record<Order['status'], 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  READY: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/** Prochain statut suggéré dans le cycle normal — l'annulation reste toujours disponible séparément. */
const NEXT_STATUS: Partial<Record<Order['status'], Order['status']>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'READY',
  READY: 'COMPLETED',
};

export function OrdersManager({ orders, currency }: { orders: Order[]; currency: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(order: Order, status: Order['status']) {
    setPendingId(order.id);
    setError(null);
    try {
      await api.patch(`/api/boutique/commandes/${order.id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le statut n'a pas pu être changé.");
    } finally {
      setPendingId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-surface-border p-10 text-center text-sm text-ink-muted">
        Aucune commande en ligne pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
          {error}
        </p>
      )}

      {orders.map((order) => {
        const next = NEXT_STATUS[order.status];
        const isFinal = order.status === 'COMPLETED' || order.status === 'CANCELLED';

        return (
          <Card key={order.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  n°{order.number}
                  <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {order.customerName} · {order.customerPhone}
                  {order.customerEmail && <> · {order.customerEmail}</>}
                </p>
                <p className="text-xs text-ink-faint">
                  {new Date(order.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <p className="text-lg font-semibold">{formatMoney(order.total, currency)}</p>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-ink-muted">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {formatQty(item.quantity)} × {item.productName}
                  </span>
                  <span>{formatMoney(item.total, currency)}</span>
                </li>
              ))}
            </ul>

            {order.notes && (
              <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
                {order.notes}
              </p>
            )}

            {!isFinal && (
              <div className="mt-4 flex flex-wrap gap-2">
                {next && (
                  <button
                    type="button"
                    disabled={pendingId === order.id}
                    onClick={() => changeStatus(order, next)}
                    className={cx(
                      'rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-50',
                    )}
                  >
                    {pendingId === order.id ? 'Traitement…' : `Marquer « ${STATUS_LABELS[next]} »`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingId === order.id}
                  onClick={() => changeStatus(order, 'CANCELLED')}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
