'use client';

import { useEffect, useOptimistic, useRef, useState } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { describeOptions, readOptions } from '@/lib/orders/option-snapshot';
import type { KitchenOrder } from '@/lib/kitchen';
import { AlertMessage, Card, cx } from '@/components/ui';

/**
 * Écran cuisine — trois colonnes, une fiche par commande.
 *
 * ## Pourquoi la fiche change de colonne avant la réponse du serveur
 *
 * En cuisine, l'écran est consulté les mains occupées, souvent à distance, et
 * l'appui se fait en passant. La fiche restait auparavant dans sa colonne
 * jusqu'au retour du serveur : sur une connexion lente, le cuisinier voyait
 * son plat toujours « à préparer » et rappuyait. L'action partait deux fois.
 *
 * La fiche part donc dans la colonne suivante dès l'appui. React tient cette
 * position le temps de l'appel et la remplace par l'état réel ensuite : si le
 * serveur refuse, la fiche revient à sa place et l'erreur s'affiche.
 */

/**
 * Au-delà de ce délai, une commande est signalée comme attendant depuis trop
 * longtemps. Quinze minutes : au-dessous, c'est une préparation normale ; au
 * -dessus, quelqu'un doit s'en occuper ou prévenir le client.
 */
const LATE_AFTER_MINUTES = 15;

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
  const mutation = useServerMutation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le relevé périodique ne doit pas ramener un statut périmé par-dessus une
  // avancée en cours : une réponse partie avant l'appui arrive après lui.
  const inFlightRef = useRef(0);

  const [shownOrders, moveLocally] = useOptimistic(
    orders,
    (current: KitchenOrder[], change: { id: string; status: KitchenOrder['status'] }) =>
      current.map((order) =>
        order.id === change.id ? { ...order, status: change.status } : order,
      ),
  );

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{ orders: KitchenOrder[] }>('/api/cuisine');
        if (!cancelled && inFlightRef.current === 0) setOrders(data.orders);
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

  function advance(order: KitchenOrder, next: KitchenOrder['status']) {
    mutation.run(
      async () => {
        moveLocally({ id: order.id, status: next });
        inFlightRef.current += 1;
        try {
          await api.patch(`/api/commandes/${order.id}`, { status: next });
          setOrders((current) =>
            current.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
          );
        } finally {
          inFlightRef.current -= 1;
        }
      },
      {
        key: order.id,
        // Cet écran tient sa propre liste et la rafraîchit tout seul toutes
        // les douze secondes : lui redemander un rendu complet du serveur
        // n'apporterait rien et ferait clignoter les trois colonnes.
        skipRefresh: true,
        failureMessage: "Le statut n'a pas pu être mis à jour.",
      },
    );
  }

  return (
    <div>
      <AlertMessage message={mutation.error} className="mb-4" />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnOrders = shownOrders.filter((order) => order.status === column.status);
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

                {columnOrders.map((order) => {
                  const waited = elapsedMinutes(order.placedAt);
                  const late = waited >= LATE_AFTER_MINUTES;

                  return (
                    <Card key={order.id} className="p-3.5">
                      <div className="flex items-baseline justify-between gap-2">
                        {/* Le numéro est lu de loin, souvent en criant « la
                            douze est prête » à travers la cuisine. Il mérite
                            d'être la chose la plus grosse de la fiche. */}
                        <p className="text-lg font-semibold leading-none text-ink">
                          n°{order.number}
                        </p>
                        <span
                          className={cx(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                            late
                              ? 'bg-state-warn-soft text-state-warn'
                              : 'bg-surface-sunken text-ink-muted',
                          )}
                        >
                          {waited} min
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-ink-faint">
                        {order.table
                          ? order.table.label
                          : order.fulfillmentType === 'DELIVERY'
                            ? 'Livraison'
                            : 'À emporter'}
                      </p>

                      <ul className="mt-2.5 space-y-1.5 text-sm">
                        {order.items.map((item) => {
                          const options = describeOptions(readOptions(item.options));
                          return (
                            <li key={item.id} className="flex gap-2">
                              {/* La quantité est détachée du nom : « 3 × » perdu
                                  au milieu d'une phrase se lit comme un « 8 »,
                                  et on prépare trois plats de trop. */}
                              <span className="shrink-0 font-semibold tabular-nums text-ink">
                                {item.quantity}×
                              </span>
                              <span className="min-w-0">
                                <span className="text-ink">{item.productName}</span>
                                {item.variantName && (
                                  <span className="text-ink-muted"> ({item.variantName})</span>
                                )}
                                {/* Les options étaient chargées depuis la base
                                    et jamais affichées : « sans piment » ou
                                    « bien cuit » n'atteignait pas la personne
                                    qui cuisine. */}
                                {options && (
                                  <span className="mt-0.5 block text-xs font-medium text-state-warn">
                                    {options}
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {order.instructions && (
                        <p className="mt-2.5 rounded-lg bg-state-warn-soft px-2.5 py-2 text-xs font-medium text-state-warn">
                          {order.instructions}
                        </p>
                      )}

                      {column.next && (
                        <button
                          type="button"
                          disabled={mutation.pending}
                          aria-busy={mutation.isPending(order.id) || undefined}
                          onClick={() => advance(order, column.next!)}
                          className="mt-3 h-11 w-full rounded-lg bg-ink text-sm font-medium text-white transition-transform hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50"
                        >
                          {column.status === 'CONFIRMED' ? 'Démarrer' : 'Marquer prête'}
                        </button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
