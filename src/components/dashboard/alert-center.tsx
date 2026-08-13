'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatMoney } from '@/lib/money';
import { api } from '@/lib/client/api';
import { Button, Card, EmptyState, LinkButton } from '@/components/ui';

type OrderAlert = { id: string; number: number; total: number; currency: string; placedAt: string };
type TableCallAlert = { id: string; title: string; body: string; createdAt: string };
type ReservationAlert = { id: string; customerName: string; partySize: number; reservedFor: string };

export function AlertCenter({
  orders,
  tableCalls,
  reservations,
}: {
  orders: OrderAlert[];
  tableCalls: TableCallAlert[];
  reservations: ReservationAlert[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function handleTableCall(id: string) {
    setPendingId(id);
    try {
      await api.patch(`/api/alertes/table-calls/${id}`, {});
      setDismissed((current) => new Set(current).add(id));
      router.refresh();
    } catch {
      // Un échec ponctuel laisse l'alerte visible : l'employé peut réessayer.
    } finally {
      setPendingId(null);
    }
  }

  const visibleTableCalls = tableCalls.filter((call) => !dismissed.has(call.id));
  const total = orders.length + visibleTableCalls.length + reservations.length;

  if (total === 0) {
    return (
      <Card className="p-4 sm:p-5">
        <EmptyState title="Rien en attente" description="Tout est traité — bon service !" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {orders.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Commandes à confirmer</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">
                  n°{order.number} · {formatMoney(order.total, order.currency)}
                </span>
                <LinkButton href={`/dashboard/commandes/${order.id}`} size="sm" variant="secondary">
                  Ouvrir
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {visibleTableCalls.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Appels de salle</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {visibleTableCalls.map((call) => (
              <li key={call.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{call.body}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pendingId === call.id}
                  onClick={() => handleTableCall(call.id)}
                >
                  Traité
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reservations.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Réservations à valider</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">
                  {reservation.customerName} · {reservation.partySize} pers. ·{' '}
                  {new Date(reservation.reservedFor).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <LinkButton href="/dashboard/reservations" size="sm" variant="secondary">
                  Ouvrir
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
