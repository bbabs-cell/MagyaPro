'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatMoney } from '@/lib/money';
import { ApiError, api } from '@/lib/client/api';
import { Button, Card, EmptyState, LinkButton } from '@/components/ui';

type OrderAlert = { id: string; number: number; total: number; currency: string; placedAt: string };
type TableCallAlert = { id: string; title: string; body: string; createdAt: string };
type ReservationAlert = { id: string; customerName: string; partySize: number; reservedFor: string };
type PaymentProofAlert = {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  provider: string;
  amount: number;
  currency: string;
  proofImageUrl: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  orange_money_manual: 'Orange Money',
  wave_manual: 'Wave',
};

export function AlertCenter({
  orders,
  tableCalls,
  reservations,
  paymentProofs,
}: {
  orders: OrderAlert[];
  tableCalls: TableCallAlert[];
  reservations: ReservationAlert[];
  paymentProofs: PaymentProofAlert[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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

  async function verifyPayment(payment: PaymentProofAlert, status: 'PAID' | 'FAILED') {
    setPendingId(payment.id);
    setError(null);
    try {
      await api.patch(`/api/paiements/${payment.id}`, { status });
      setDismissed((current) => new Set(current).add(payment.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La vérification n'a pas pu être enregistrée.");
    } finally {
      setPendingId(null);
    }
  }

  const visibleTableCalls = tableCalls.filter((call) => !dismissed.has(call.id));
  const visiblePaymentProofs = paymentProofs.filter((payment) => !dismissed.has(payment.id));
  const total =
    orders.length + visibleTableCalls.length + reservations.length + visiblePaymentProofs.length;

  if (total === 0) {
    return (
      <Card className="p-4 sm:p-5">
        <EmptyState title="Rien en attente" description="Tout est traité — bon service !" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {visiblePaymentProofs.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Preuves de paiement à vérifier</h2>
          <ul className="mt-3 space-y-4">
            {visiblePaymentProofs.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-3">
                <a href={payment.proofImageUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- capture d'écran déposée par le client */}
                  <img
                    src={payment.proofImageUrl}
                    alt="Preuve de paiement"
                    className="h-16 w-16 rounded-lg border border-surface-border object-cover"
                  />
                </a>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {payment.orderNumber ? `n°${payment.orderNumber}` : 'Commande'} ·{' '}
                    {formatMoney(payment.amount, payment.currency)}
                  </p>
                  <p className="text-ink-muted">{PROVIDER_LABELS[payment.provider] ?? payment.provider}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    disabled={pendingId === payment.id}
                    onClick={() => verifyPayment(payment, 'PAID')}
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pendingId === payment.id}
                    onClick={() => verifyPayment(payment, 'FAILED')}
                  >
                    Rejeter
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
