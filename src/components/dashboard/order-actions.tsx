'use client';

import { useState } from 'react';
import type { OrderStatus, PaymentStatus } from '@prisma/client';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/lib/orders/status';
import { AlertMessage, Button, Field, inputClass } from '@/components/ui';

/**
 * Avancement du statut et encaissement, depuis la fiche commande.
 *
 * L'annulation demande un motif : il est consigné dans l'historique et permet
 * de justifier auprès du client.
 *
 * Encaisser et terminer sont deux boutons distincts. Ils n'en faisaient qu'un
 * — « Marquer payé et terminer » — et il n'apparaissait que sur une commande
 * livrée : une commande emportée au comptoir n'avait donc aucun moyen d'être
 * déclarée payée.
 */
export function OrderActions({
  orderId,
  status,
  paymentStatus,
  canUpdate,
  canCancel,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
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

  function markPaid() {
    mutation.run(() => api.post(`/api/commandes/${orderId}/payer`), {
      key: 'paiement',
      // De l'argent qui entre : cela se confirme, même quand la mention
      // « Paiement » change juste au-dessus.
      successMessage: 'Commande marquée payée.',
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

  /**
   * L'encaissement ne dépend ni du statut ni du mode de retrait : on paie au
   * comptoir avant de recevoir son plat, à la remise pour une livraison, et
   * parfois après coup. Le bouton reste donc disponible tant que la commande
   * n'est ni payée, ni remboursée, ni annulée.
   */
  const canMarkPaid =
    status !== 'CANCELLED' && paymentStatus !== 'PAID' && paymentStatus !== 'REFUNDED';

  const paidButton = canMarkPaid ? (
    <Button
      type="button"
      variant={status === 'DELIVERED' ? 'primary' : 'secondary'}
      loading={mutation.isPending('paiement')}
      disabled={pending}
      onClick={markPaid}
    >
      Marquer payé
    </Button>
  ) : null;

  if (transitions.length === 0) {
    return (
      <div className="space-y-3">
        <AlertMessage message={mutation.error} />
        <p className="text-sm text-ink-muted">
          Cette commande est {ORDER_STATUS_LABELS[status].toLowerCase()} : son
          statut n&apos;évolue plus.
        </p>
        {/* Une commande terminée dont le paiement n'a jamais été constaté
            reste encaissable : son statut est figé, pas son argent. */}
        {paidButton && <div className="flex flex-wrap gap-2">{paidButton}</div>}
      </div>
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
          {paidButton}
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
