'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderStatus, PaymentStatus } from '@prisma/client';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/lib/orders/service';
import { PAYMENT_STATUS_LABELS } from '@/lib/payments/service';
import { ORDER_STATUS_TONES } from '@/components/dashboard/order-status';
import { Badge, Button } from '@/components/ui';

/**
 * Liste des commandes avec avancement du statut.
 *
 * Les transitions proposées viennent de `ORDER_TRANSITIONS`, la même table que
 * le serveur applique : l'interface ne peut pas suggérer un enchaînement qui
 * serait ensuite refusé.
 *
 * En dessous de `md`, le tableau devient une pile de fiches (`table-stack`) :
 * un tableau à six colonnes est illisible sur un téléphone, et c'est
 * précisément là que le service consulte ses commandes.
 */

type Order = {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  customerName: string;
  customerPhone: string;
  total: number;
  itemCount: number;
  placedAt: string;
};

export function OrdersBoard({
  orders,
  currency,
  canCancel,
  canUpdate,
}: {
  orders: Order[];
  currency: string;
  canCancel: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(order: Order, status: OrderStatus) {
    // L'annulation est irréversible et visible du client : elle mérite une
    // confirmation explicite.
    if (status === 'CANCELLED') {
      const confirmed = window.confirm(
        `Annuler la commande n°${order.number} ? Cette action est définitive.`,
      );
      if (!confirmed) return;
    }

    setPendingId(order.id);
    setError(null);

    try {
      await api.patch(`/api/commandes/${order.id}`, { status });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Le statut n'a pas pu être modifié. Réessayez.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table-stack w-full border-collapse text-sm">
          <caption className="sr-only">Liste des commandes</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-3 font-medium">Commande</th>
              <th scope="col" className="py-2 pr-3 font-medium">Client</th>
              <th scope="col" className="py-2 pr-3 font-medium">Statut</th>
              <th scope="col" className="py-2 pr-3 font-medium">Paiement</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Total</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => {
              const nextStatuses = ORDER_TRANSITIONS[order.status].filter(
                (status) => status !== 'CANCELLED' || canCancel,
              );
              const isPending = pendingId === order.id;

              return (
                <tr key={order.id} className="border-b border-surface-border align-middle">
                  <td data-label="Commande" className="py-3 pr-3">
                    <Link
                      href={`/dashboard/commandes/${order.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      n°{order.number}
                    </Link>
                    <span className="block text-xs text-ink-faint">
                      {new Date(order.placedAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
                      {' · '}
                      {order.fulfillmentType === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                    </span>
                  </td>

                  <td data-label="Client" className="py-3 pr-3">
                    <span className="block">{order.customerName}</span>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="block text-xs text-ink-muted underline-offset-4 hover:underline"
                    >
                      {order.customerPhone}
                    </a>
                  </td>

                  <td data-label="Statut" className="py-3 pr-3">
                    <Badge tone={ORDER_STATUS_TONES[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>

                  <td data-label="Paiement" className="py-3 pr-3">
                    <span className="text-ink-muted">
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>

                  <td data-label="Total" className="py-3 pr-3 text-right font-medium">
                    {formatMoney(order.total, currency)}
                  </td>

                  <td data-label="" className="py-3">
                    {canUpdate && nextStatuses.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {nextStatuses.map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={status === 'CANCELLED' ? 'ghost' : 'secondary'}
                            disabled={isPending}
                            onClick={() => changeStatus(order, status)}
                          >
                            {status === 'CANCELLED'
                              ? 'Annuler'
                              : ORDER_STATUS_LABELS[status]}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-ink-faint">
                        {nextStatuses.length === 0 ? 'Terminée' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
