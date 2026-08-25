'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';

/**
 * Fait sonner une notification à l'arrivée de tout nouvel événement non lu
 * (commande, changement de réglages, stock, paiement, réservation…) — Core,
 * partagé entre Restaurant et Boutique, monté dans les deux ossatures de
 * tableau de bord. Joue le son personnalisé du tenant s'il en a téléversé un
 * (`notificationSoundUrl`, renvoyé par l'endpoint interrogé), sinon un bip
 * généré par le navigateur (Web Audio API). Pour Restaurant, les commandes
 * sont déjà signalées séparément par `AlertWatcher` (son + rappel toutes les
 * 2 min) — ce composant les ignore via `skipTypesForSound` pour ne pas
 * sonner deux fois pour le même événement.
 */

const POLL_INTERVAL_MS = 15_000;

function beep(): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 740;
    gain.gain.value = 0.1;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
    oscillator.onended = () => void context.close();
  } catch {
    // Contexte audio indisponible (autoplay bloqué avant interaction) : le
    // badge de navigation reste le signal visuel de secours.
  }
}

/** Joue le son personnalisé du tenant, ou le bip par défaut à défaut. */
function playSound(customSoundUrl: string | null): void {
  if (!customSoundUrl) {
    beep();
    return;
  }
  try {
    const audio = new Audio(customSoundUrl);
    audio.volume = 0.6;
    void audio.play().catch(() => beep());
  } catch {
    beep();
  }
}

type NotificationRow = { id: string; type: string; readAt: string | null };

export function NotificationWatcher({
  endpoint,
  skipTypesForSound = [],
}: {
  endpoint: string;
  /** Types déjà signalés par un autre mécanisme (ex. les commandes côté
   * Restaurant, via `AlertWatcher`) — évite un double bip pour le même
   * événement. */
  skipTypesForSound?: string[];
}) {
  const knownIds = useRef<Set<string> | null>(null);
  const router = useRouter();
  // Les appelants passent souvent un littéral de tableau inline
  // (`skipTypesForSound={['ORDER_CREATED']}`), une référence différente à
  // chaque rendu — s'y fier directement comme dépendance relancerait le
  // sondage à chaque rendu du composant parent. Une clé stable dérivée de
  // son contenu suffit.
  const skipKey = skipTypesForSound.join(',');

  useEffect(() => {
    let cancelled = false;
    const skipSet = new Set(skipKey ? skipKey.split(',') : []);

    async function poll() {
      try {
        const data = await api.get<{
          notifications: NotificationRow[];
          notificationSoundUrl?: string | null;
        }>(endpoint);
        if (cancelled) return;

        const currentIds = new Set(data.notifications.map((n) => n.id));
        // `null` uniquement au tout premier appel : l'état initial ne doit
        // pas être confondu avec des notifications fraîchement arrivées.
        if (knownIds.current) {
          const hasNewSoundworthy = data.notifications.some(
            (n) => !knownIds.current!.has(n.id) && !n.readAt && !skipSet.has(n.type),
          );
          if (hasNewSoundworthy) {
            playSound(data.notificationSoundUrl ?? null);
            router.refresh();
          }
        }
        knownIds.current = currentIds;
      } catch {
        // Une erreur ponctuelle ne doit pas déclencher de fausse alerte.
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint, router, skipKey]);

  return null;
}
