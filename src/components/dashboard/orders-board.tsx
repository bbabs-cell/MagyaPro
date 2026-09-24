'use client';

import { useOptimistic } from 'react';
import Link from 'next/link';
import type { OrderStatus, PaymentStatus } from '@prisma/client';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/lib/orders/status';
import { PAYMENT_STATUS_LABELS } from '@/lib/payments/status';
import { deliveryPaymentLabel } from '@/lib/orders/delivery-collection';
import { ORDER_STATUS_TONES } from '@/components/dashboard/order-status';
import { AlertMessage, Badge, Button } from '@/components/ui';

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
 *
 * ## Affichage anticipé du statut
 *
 * Le badge et les boutons de la ligne prennent le nouveau statut **dès
 * l'appui**, sans attendre le serveur. En salle, la question posée à l'écran
 * est « est-ce que mon appui a été pris en compte », et un badge qui ne bouge
 * pas pendant deux secondes répond non — le serveur, lui, dira oui.
 *
 * Ce n'est pas un affichage inventé : React tient la valeur anticipée le temps
 * de la transition et la remplace par la réponse réelle du serveur, quelle
 * qu'elle soit. Si l'appel échoue, la ligne revient d'elle-même à son ancien
 * statut et le bandeau d'erreur explique pourquoi. Jamais l'écran ne reste sur
 * une valeur que la base ne porte pas.
 */

type Order = {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  tableLabel: string | null;
  customerName: string;
  /** Absent pour une commande prise au comptoir sans numéro. */
  customerPhone: string | null;
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
  const mutation = useServerMutation();

  // La liste affichée est celle du serveur, éventuellement corrigée par la
  // ligne en cours de modification.
  const [shownOrders, applyLocally] = useOptimistic(
    orders,
    (current: Order[], change: { id: string; status?: OrderStatus; paid?: boolean }) =>
      current.map((order) =>
        order.id === change.id
          ? {
              ...order,
              status: change.status ?? order.status,
              paymentStatus: change.paid ? ('PAID' as PaymentStatus) : order.paymentStatus,
            }
          : order,
      ),
  );

  function changeStatus(order: Order, status: OrderStatus) {
    // L'annulation est irréversible et visible du client : elle mérite une
    // confirmation explicite.
    if (status === 'CANCELLED') {
      const confirmed = window.confirm(
        `Annuler la commande n°${order.number} ? Cette action est définitive.`,
      );
      if (!confirmed) return;
    }

    mutation.run(
      async () => {
        applyLocally({ id: order.id, status });
        await api.patch(`/api/commandes/${order.id}`, { status });
      },
      {
        key: `${order.id}:${status}`,
        // Le badge de la ligne change déjà sous les yeux : une confirmation
        // par-dessus serait du bruit. C'est la règle — on ne confirme que ce
        // qui ne se voit pas.
        failureMessage: "Le statut n'a pas pu être modifié. Réessayez.",
      },
    );
  }

  /**
   * Encaisser, sans rien changer d'autre.
   *
   * Cette action terminait aussi la commande, et n'était proposée que sur une
   * livraison. Une commande emportée au comptoir n'avait donc aucun bouton
   * pour dire que l'argent était arrivé.
   */
  function markPaid(order: Order) {
    mutation.run(
      async () => {
        applyLocally({ id: order.id, paid: true });
        await api.post(`/api/commandes/${order.id}/payer`);
      },
      {
        key: `${order.id}:paiement`,
        // De l'argent qui entre : celui-là se confirme, même si la colonne
        // « Paiement » change aussi sous les yeux.
        successMessage: 'Commande marquée payée.',
        failureMessage: "Le paiement n'a pas pu être confirmé. Réessayez.",
      },
    );
  }

  return (
    <>
      <AlertMessage message={mutation.error} className="mb-4" />

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
            {shownOrders.map((order) => {
              const nextStatuses = ORDER_TRANSITIONS[order.status].filter(
                (status) => status !== 'CANCELLED' || canCancel,
              );
              // Tant que l'argent n'est pas constaté et que la commande vit
              // encore, l'encaissement reste proposé — quel que soit le stade.
              const canMarkPaid =
                order.status !== 'CANCELLED' &&
                order.paymentStatus !== 'PAID' &&
                order.paymentStatus !== 'REFUNDED';
              // Le tour de roue ne tourne que sur le bouton réellement
              // pressé ; tous les autres sont seulement inactifs le temps que
              // l'action se termine. Deux commandes modifiées en même temps se
              // chevaucheraient à l'écran sans qu'on sache laquelle a abouti.
              const isLocked = mutation.pending;
              // La ligne affiche déjà son nouveau statut, mais celui-ci n'est
              // pas encore confirmé par le serveur. `aria-busy` le dit aux
              // lecteurs d'écran, et l'opacité réduite le dit aux autres :
              // le statut affiché ici est en cours de validation, pas acquis.
              // Sans cela, une ligne « Payé » affichée par anticipation serait
              // indiscernable d'une ligne réellement encaissée.
              const isSettling =
                mutation.isPending(`${order.id}:paiement`) ||
                nextStatuses.some((status) => mutation.isPending(`${order.id}:${status}`)) ||
                mutation.isPending(`${order.id}:CANCELLED`);

              return (
                <tr
                  key={order.id}
                  aria-busy={isSettling || undefined}
                  className={`border-b border-surface-border align-middle transition-opacity ${
                    isSettling ? 'opacity-60' : ''
                  }`}
                >
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
                      {order.fulfillmentType === 'DELIVERY'
                        ? 'Livraison'
                        : order.fulfillmentType === 'DINE_IN'
                          ? `Sur place${order.tableLabel ? ` · ${order.tableLabel}` : ''}`
                          : 'Retrait'}
                    </span>
                  </td>

                  <td data-label="Client" className="py-3 pr-3">
                    <span className="block">{order.customerName}</span>
                    {/* Un lien `tel:` sans numéro composerait « null ». Une
                        commande au comptoir n'en a pas : on l'écrit. */}
                    {order.customerPhone ? (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="block text-xs text-ink-muted underline-offset-4 hover:underline"
                      >
                        {order.customerPhone}
                      </a>
                    ) : (
                      <span className="block text-xs text-ink-faint">Sans numéro</span>
                    )}
                  </td>

                  <td data-label="Statut" className="py-3 pr-3">
                    <Badge tone={ORDER_STATUS_TONES[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>

                  <td data-label="Paiement" className="py-3 pr-3">
                    {/* Sur une livraison, « en cours » ne renseigne personne :
                        le restaurateur veut savoir si l'argent est chez le
                        client, chez son livreur, ou dans sa caisse. Les autres
                        modes gardent le libellé générique, qui leur suffit. */}
                    <span className="text-ink-muted">
                      {order.fulfillmentType === 'DELIVERY'
                        ? deliveryPaymentLabel(order.paymentStatus)
                        : PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>

                  <td data-label="Total" className="py-3 pr-3 text-right font-medium">
                    {formatMoney(order.total, currency)}
                  </td>

                  <td data-label="" className="py-3">
                    {canUpdate && (canMarkPaid || nextStatuses.length > 0) ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {/* Encaisser ne dépend plus du mode de retrait : une
                            commande emportée se règle au comptoir, et n'a
                            jamais de livreur pour rapporter l'argent. */}
                        {canMarkPaid && (
                          <Button
                            type="button"
                            size="sm"
                            variant={order.status === 'DELIVERED' ? 'primary' : 'secondary'}
                            loading={mutation.isPending(`${order.id}:paiement`)}
                            disabled={isLocked}
                            onClick={() => markPaid(order)}
                          >
                            Marquer payé
                          </Button>
                        )}
                        {nextStatuses.map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={status === 'CANCELLED' ? 'ghost' : 'secondary'}
                            loading={mutation.isPending(`${order.id}:${status}`)}
                            disabled={isLocked}
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
                        {nextStatuses.length === 0 ? ORDER_STATUS_LABELS[order.status] : '—'}
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
