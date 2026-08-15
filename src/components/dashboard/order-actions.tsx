'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';

import { ApiError, api } from '@/lib/client/api';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/lib/orders/status';
import { Button, Field, inputClass } from '@/components/ui';

/**
 * Avancement du statut depuis la fiche commande.
 *
 * L'annulation demande un motif : il est consigné dans l'historique et permet
 * de justifier auprès du client.
 */
export function OrderActions({
  orderId,
  status,
  canUpdate,
  canCancel,
}: {
  orderId: string;
  status: OrderStatus;
  canUpdate: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const transitions = ORDER_TRANSITIONS[status].filter(
    (next) => next !== 'CANCELLED' || canCancel,
  );

  async function apply(next: OrderStatus, note?: string) {
    setPending(true);
    setError(null);

    try {
      await api.patch(`/api/commandes/${orderId}`, { status: next, note });
      setCancelling(false);
      setReason('');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Le statut n'a pas pu être modifié. Réessayez.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmPayment() {
    setPending(true);
    setError(null);

    try {
      await api.post(`/api/commandes/${orderId}/payer`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Le paiement n'a pas pu être confirmé. Réessayez.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!canUpdate) {
    return (
      <p className="text-sm text-ink-muted">
        Vous n&apos;avez pas les droits pour modifier cette commande.
      </p>
    );
  }

  if (status === 'DELIVERED') {
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <p className="text-sm text-ink-muted">
          Le livreur a confirmé la remise au client. Terminez la commande une
          fois l&apos;argent reçu.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={confirmPayment}>
            {pending ? 'Confirmation…' : 'Marquer payé et terminer'}
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => apply('CANCELLED')}
            >
              Annuler la commande
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Cette commande est {ORDER_STATUS_LABELS[status].toLowerCase()} : son
        statut n&apos;évolue plus.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {cancelling ? (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <Field
            label="Motif de l'annulation"
            htmlFor="cancel-reason"
            hint="Conservé dans l'historique de la commande."
          >
            <input
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={inputClass}
              placeholder="Rupture de stock, client injoignable…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => apply('CANCELLED', reason || undefined)}
            >
              {pending ? 'Annulation…' : "Confirmer l'annulation"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setCancelling(false)}
            >
              Revenir
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {transitions.map((next) =>
            next === 'CANCELLED' ? (
              <Button
                key={next}
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setCancelling(true)}
              >
                Annuler la commande
              </Button>
            ) : (
              <Button
                key={next}
                type="button"
                disabled={pending}
                onClick={() => apply(next)}
              >
                Marquer « {ORDER_STATUS_LABELS[next]} »
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
