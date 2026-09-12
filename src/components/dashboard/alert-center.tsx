'use client';

import { useState } from 'react';

import { formatMoney } from '@/lib/money';
import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { AlertMessage, Button, Card, EmptyState, LinkButton } from '@/components/ui';

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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const mutation = useServerMutation();

  // L'échec était ici purement et simplement ignoré — `catch {}` avec un
  // commentaire disant que l'employé pourrait réessayer, alors que rien à
  // l'écran ne lui apprenait qu'il y avait quelque chose à réessayer. En plein
  // service, l'appel de salle restait affiché et personne ne savait pourquoi.
  function handleTableCall(id: string) {
    mutation.run(() => api.patch(`/api/alertes/table-calls/${id}`, {}), {
      key: id,
      onSuccess: () => setDismissed((current) => new Set(current).add(id)),
      failureMessage: "L'appel n'a pas pu être marqué comme traité.",
    });
  }

  function verifyPayment(payment: PaymentProofAlert, status: 'PAID' | 'FAILED') {
    mutation.run(() => api.patch(`/api/paiements/${payment.id}`, { status }), {
      key: `${payment.id}:${status}`,
      onSuccess: () => setDismissed((current) => new Set(current).add(payment.id)),
      // Un encaissement validé ou refusé engage de l'argent : la ligne
      // disparaît de la liste, ce qui ne dit pas laquelle des deux décisions a
      // été enregistrée.
      successMessage:
        status === 'PAID'
          ? `Paiement validé — ${formatMoney(payment.amount, payment.currency)}.`
          : 'Paiement refusé, la commande reste impayée.',
      failureMessage: "La vérification n'a pas pu être enregistrée.",
    });
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
      <AlertMessage message={mutation.error} />

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
                    loading={mutation.isPending(`${payment.id}:PAID`)}
                    disabled={mutation.pending}
                    onClick={() => verifyPayment(payment, 'PAID')}
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={mutation.isPending(`${payment.id}:FAILED`)}
                    disabled={mutation.pending}
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
                  loading={mutation.isPending(call.id)}
                  disabled={mutation.pending}
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
