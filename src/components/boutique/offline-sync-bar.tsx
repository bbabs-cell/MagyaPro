'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import {
  getQueue,
  markQueueItemFailed,
  markQueueItemPending,
  removeFromQueue,
  type QueuedSale,
} from '@/lib/boutique/offline-queue';
import { Badge, Button, Card } from '@/components/ui';

/**
 * Bandeau de statut hors ligne + file d'attente — voir `offline-queue.ts`.
 * Synchronise automatiquement au retour du réseau (`online`), et propose
 * une synchronisation manuelle sinon.
 */
/**
 * Une erreur qui dit « plus tard », pas « non ».
 *
 * - pas de réseau : la vente attend le retour du signal ;
 * - session expirée (401) : elle attend qu'on se reconnecte ;
 * - trop de requêtes (429) ou serveur en difficulté (5xx) : elle attend
 *   quelques instants.
 *
 * Jusqu'ici, tout ce qui n'était pas une panne réseau passait la vente en
 * « échec » définitif. Une session expirée pendant la coupure suffisait à
 * faire basculer toute la file en échec, avec pour seule issue « Ignorer ».
 *
 * Renvoyer est sans danger : chaque vente porte l'identifiant tiré par la
 * caisse avant son premier envoi, et le serveur rend une vente déjà reçue
 * au lieu d'en créer une seconde.
 */
function retryLater(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'NETWORK_ERROR') return 'Réseau toujours indisponible.';
  if (err.status === 401) return 'Session expirée : reconnectez-vous pour envoyer les ventes en attente.';
  if (err.status === 429 || err.status >= 500) return 'Le serveur ne répond pas pour l’instant ; nouvel essai dans un moment.';
  return null;
}

/** Délai avant un nouvel essai automatique, quand le serveur a dit « plus tard ». */
const RETRY_DELAY_MS = 30_000;

export function OfflineSyncBar({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueueState] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  /** Pourquoi la file attend encore, quand ce n'est pas le réseau. */
  const [waitingReason, setWaitingReason] = useState<string | null>(null);

  const refreshQueue = useCallback(() => setQueueState(getQueue(storeId)), [storeId]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      setWaitingReason(null);
      for (const item of getQueue(storeId).filter((entry) => entry.status === 'pending')) {
        try {
          await api.post('/api/boutique/sales', item.payload);
          removeFromQueue(storeId, item.id);
        } catch (err) {
          const later = retryLater(err);
          if (later) {
            // On s'arrête là : les suivantes buteraient sur la même cause.
            if (!(err instanceof ApiError && err.code === 'NETWORK_ERROR')) setWaitingReason(later);
            break;
          }
          // Refusée par le serveur (stock insuffisant entre-temps, etc.) :
          // signalée pour vérification, avec un nouvel essai possible.
          markQueueItemFailed(storeId, item.id, err instanceof ApiError ? err.message : 'Échec inconnu.');
        }
      }
    } finally {
      refreshQueue();
      setSyncing(false);
      router.refresh();
    }
  }, [storeId, syncing, refreshQueue, router]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshQueue();

    function handleOnline() {
      setIsOnline(true);
      void sync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Une vente ajoutée par la caisse (autre composant) ne déclenche pas de
    // ré-render ici automatiquement : on relit la file périodiquement.
    const interval = setInterval(refreshQueue, 3000);

    // Les ventes laissées en attente à la dernière fermeture de l'onglet
    // partent dès l'ouverture, si le réseau est là — sans attendre un
    // événement `online` qui ne viendra pas, puisque le réseau ne revient pas :
    // il est déjà là.
    if (navigator.onLine && getQueue(storeId).some((item) => item.status === 'pending')) {
      void sync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sync` déclenché volontairement uniquement par l'événement `online`
  }, [refreshQueue]);

  // Nouvel essai automatique quand le serveur a dit « plus tard ».
  useEffect(() => {
    if (!waitingReason) return;
    const timer = setTimeout(() => void sync(), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waitingReason, sync]);

  const pending = queue.filter((item) => item.status === 'pending');
  const failed = queue.filter((item) => item.status === 'failed');

  if (isOnline && queue.length === 0) return null;

  return (
    <Card className="mb-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isOnline && <Badge tone="warning">Hors ligne</Badge>}
          <p className="text-sm text-ink-muted">
            {!isOnline && 'Les ventes sont enregistrées localement et seront synchronisées au retour de la connexion. '}
            {pending.length > 0 &&
              `${pending.length} vente${pending.length > 1 ? 's' : ''} en attente de synchronisation.`}
            {failed.length > 0 &&
              ` ${failed.length} vente${failed.length > 1 ? 's' : ''} en échec, à vérifier.`}
            {isOnline && waitingReason && ` ${waitingReason}`}
          </p>
        </div>
        {isOnline && pending.length > 0 && (
          <Button size="sm" variant="secondary" loading={syncing} onClick={() => void sync()}>
            Synchroniser maintenant
          </Button>
        )}
      </div>

      {failed.length > 0 && (
        <ul className="mt-3 space-y-2">
          {failed.map((item) => (
            <li key={item.id} className="rounded-lg bg-state-bad-soft px-3 py-2 text-xs text-state-bad">
              <p>{item.error}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => {
                    markQueueItemPending(storeId, item.id);
                    refreshQueue();
                    void sync();
                  }}
                  className="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeFromQueue(storeId, item.id);
                    refreshQueue();
                  }}
                  className="inline-flex min-h-6 items-center underline underline-offset-2"
                >
                  Ignorer cette vente (ne sera pas enregistrée)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
