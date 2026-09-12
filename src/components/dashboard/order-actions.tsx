'use client';

import { useState } from 'react';
import type { OrderStatus } from '@prisma/client';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/lib/orders/status';
import { AlertMessage, Button, Field, inputClass } from '@/components/ui';

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
  const mutation = useServerMutation();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const pending = mutation.pending;

  const transitions = ORDER_TRANSITIONS[status].filter(
    (next) => next !== 'CANCELLED' || canCancel,
  );

  function apply(next: OrderStatus, note?: string) {
    mutation.run(() => api.patch(`/api/commandes/${orderId}`, { status: next, note }), {
      key: next,
      onSuccess: () => {
        setCancelling(false);
        setReason('');
      },
      // Contrairement à la liste des commandes, cet écran n'affiche pas de
      // ligne qui changerait de couleur sous les yeux : c'est une fiche, et le
      // statut n'y bouge qu'une fois le nouveau rendu arrivé. La confirmation
      // est donc le seul signal immédiat.
      successMessage:
        next === 'CANCELLED'
          ? 'Commande annulée.'
          : `Commande marquée « ${ORDER_STATUS_LABELS[next]} ».`,
      failureMessage: "Le statut n'a pas pu être modifié. Réessayez.",
    });
  }

  function confirmPayment() {
    mutation.run(() => api.post(`/api/commandes/${orderId}/payer`), {
      key: 'paiement',
      successMessage: 'Paiement encaissé, commande terminée.',
      failureMessage: "Le paiement n'a pas pu être confirmé. Réessayez.",
    });
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
        <AlertMessage message={mutation.error} />
        <p className="text-sm text-ink-muted">
          Le livreur a confirmé la remise au client. Terminez la commande une
          fois l&apos;argent reçu.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={mutation.isPending('paiement')} onClick={confirmPayment}>
            Marquer payé et terminer
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
      <AlertMessage message={mutation.error} />

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
              loading={mutation.isPending('CANCELLED')}
              onClick={() => apply('CANCELLED', reason || undefined)}
            >
              Confirmer l&apos;annulation
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
                loading={mutation.isPending(next)}
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
