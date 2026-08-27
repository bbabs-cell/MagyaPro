'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { getQueue, markQueueItemFailed, removeFromQueue, type QueuedSale } from '@/lib/boutique/offline-queue';
import { Badge, Button, Card } from '@/components/ui';

/**
 * Bandeau de statut hors ligne + file d'attente — voir `offline-queue.ts`.
 * Synchronise automatiquement au retour du réseau (`online`), et propose
 * une synchronisation manuelle sinon.
 */
export function OfflineSyncBar({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueueState] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshQueue = useCallback(() => setQueueState(getQueue(storeId)), [storeId]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      for (const item of getQueue(storeId)) {
        try {
          await api.post('/api/boutique/sales', item.payload);
          removeFromQueue(storeId, item.id);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
            // Réseau toujours indisponible : on s'arrête là, la vente reste en attente.
            break;
          }
          // Rejetée par le serveur (stock insuffisant entre-temps, etc.) —
          // signalée pour vérification manuelle plutôt que réessayée en boucle.
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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sync` déclenché volontairement uniquement par l'événement `online`
  }, [refreshQueue]);

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
              <button
                type="button"
                onClick={() => {
                  removeFromQueue(storeId, item.id);
                  refreshQueue();
                }}
                className="mt-1 underline underline-offset-2"
              >
                Ignorer cette vente (ne sera pas enregistrée)
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
