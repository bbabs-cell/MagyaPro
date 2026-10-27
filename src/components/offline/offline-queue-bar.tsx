'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import {
  getQueue,
  markQueueItemFailed,
  markQueueItemPending,
  removeFromQueue,
  type QueuedRequest,
} from '@/lib/client/offline-queue';
import { Badge, Button, Card } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

/**
 * Une erreur qui dit « plus tard », pas « non ».
 *
 * - pas de réseau : l'envoi attend le retour du signal ;
 * - session expirée (401) : elle attend qu'on se reconnecte ;
 * - trop de requêtes (429) ou serveur en difficulté (5xx) : elle attend
 *   quelques instants.
 *
 * Une première version passait tout ce qui n'était pas une panne réseau en
 * « échec » définitif. Une session expirée pendant la coupure suffisait à
 * faire basculer toute la file en échec, avec pour seule issue « Ignorer ».
 *
 * Renvoyer est sans danger : chaque envoi porte l'identifiant tiré par
 * l'écran avant le premier essai, et le serveur rend ce qu'il a déjà reçu
 * au lieu de le créer une seconde fois.
 */
function retryLater(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'NETWORK_ERROR') return 'Réseau toujours indisponible.';
  if (err.status === 401) return 'Session expirée : reconnectez-vous pour envoyer ce qui est en attente.';
  if (err.status === 429 || err.status >= 500) return 'Le serveur ne répond pas pour l’instant ; nouvel essai dans un moment.';
  return null;
}

/** Délai avant un nouvel essai automatique, quand le serveur a dit « plus tard ». */
const RETRY_DELAY_MS = 30_000;

/** Les mots d'une file : « vente » pour la caisse, « commande » au comptoir. */
export type QueueNoun = 'vente' | 'commande';

const plural = (count: number, noun: QueueNoun) => `${count} ${noun}${count > 1 ? 's' : ''}`;

/**
 * Bandeau de statut hors ligne et file d'attente — voir
 * `lib/client/offline-queue.ts`. Envoie automatiquement au retour du réseau
 * (`online`), et propose un envoi manuel sinon.
 *
 * Partagé par la caisse Boutique (`/api/boutique/sales`) et la prise de
 * commande au comptoir des restaurants (`/api/commandes`).
 */
export function OfflineQueueBar({
  scope,
  endpoint,
  noun,
}: {
  scope: string;
  endpoint: string;
  noun: QueueNoun;
}) {
    const router = useRouter();
  const { show } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueueState] = useState<QueuedRequest[]>([]);
  const [syncing, setSyncing] = useState(false);
  /** Pourquoi la file attend encore, quand ce n'est pas le réseau. */
  const [waitingReason, setWaitingReason] = useState<string | null>(null);

  const refreshQueue = useCallback(() => setQueueState(getQueue(scope)), [scope]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      setWaitingReason(null);
      let sent = 0;
      for (const item of getQueue(scope).filter((entry) => entry.status === 'pending')) {
        try {
          await api.post(endpoint, item.payload);
          removeFromQueue(scope, item.id);
          sent += 1;
        } catch (err) {
          const later = retryLater(err);
          if (later) {
            // On s'arrête là : les suivantes buteraient sur la même cause.
            if (!(err instanceof ApiError && err.code === 'NETWORK_ERROR')) setWaitingReason(later);
            break;
          }
          // Refusé par le serveur (stock insuffisant, plat retiré entre-temps…) :
          // signalée pour vérification, avec un nouvel essai possible.
          markQueueItemFailed(scope, item.id, err instanceof ApiError ? err.message : 'Échec inconnu.');
        }
      }
      // Ce qui attendait est parti : le dire, sinon rien à l'écran ne
      // distingue « envoyé » de « toujours en attente » une fois le bandeau
      // disparu.
      if (sent > 0) show(`${plural(sent, noun)} envoyée${sent > 1 ? 's' : ''}.`, 'success');
    } finally {
      refreshQueue();
      setSyncing(false);
      router.refresh();
    }
  }, [scope, endpoint, noun, syncing, refreshQueue, router, show]);

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
    // Un envoi ajouté par l'écran de saisie (autre composant) ne déclenche pas de
    // ré-render ici automatiquement : on relit la file périodiquement.
    const interval = setInterval(refreshQueue, 3000);

    // Les envois laissés en attente à la dernière fermeture de l'onglet
    // partent dès l'ouverture, si le réseau est là — sans attendre un
    // événement `online` qui ne viendra pas, puisque le réseau ne revient pas :
    // il est déjà là.
    if (navigator.onLine && getQueue(scope).some((item) => item.status === 'pending')) {
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
            {!isOnline &&
              `Les ${noun}s sont enregistrées sur cet appareil et partiront au retour de la connexion. `}
            {pending.length > 0 && `${plural(pending.length, noun)} en attente de synchronisation.`}
            {failed.length > 0 && ` ${plural(failed.length, noun)} en échec, à vérifier.`}
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
                    markQueueItemPending(scope, item.id);
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
                    removeFromQueue(scope, item.id);
                    refreshQueue();
                  }}
                  className="inline-flex min-h-6 items-center underline underline-offset-2"
                >
                  Ignorer cette {noun} (ne sera pas enregistrée)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
