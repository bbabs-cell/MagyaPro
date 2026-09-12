'use client';

import { useEffect, useOptimistic, useRef, useState } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { AlertMessage, Card } from '@/components/ui';

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

type KitchenOrder = {
  id: string;
  number: number;
  status: 'CONFIRMED' | 'PREPARING' | 'READY';
  fulfillmentType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  placedAt: string;
  table: { label: string } | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    options: unknown;
  }>;
};

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

                {columnOrders.map((order) => (
                  <Card key={order.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        n°{order.number}
                        {order.table && ` · ${order.table.label}`}
                      </p>
                      <span className="text-xs text-ink-faint">
                        {elapsedMinutes(order.placedAt)} min
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-sm text-ink-muted">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.productName}
                          {item.variantName && ` (${item.variantName})`}
                        </li>
                      ))}
                    </ul>
                    {column.next && (
                      <button
                        type="button"
                        disabled={mutation.pending}
                        aria-busy={mutation.isPending(order.id) || undefined}
                        onClick={() => advance(order, column.next!)}
                        className="mt-2.5 h-9 w-full rounded-lg bg-ink text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-50"
                      >
                        {column.status === 'CONFIRMED' ? 'Démarrer' : 'Marquer prête'}
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
