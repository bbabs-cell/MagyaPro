'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';

/**
 * Centre d'alertes : détecte les nouvelles commandes et les fait apparaître
 * sans que le personnel ait à actualiser la page.
 *
 * Un bip généré par le navigateur (Web Audio API) par défaut — pas de
 * fichier audio à charger, ce qui fonctionne dès l'installation — ou le son
 * personnalisé téléversé par le restaurant (`/dashboard/parametres`), s'il en
 * existe un. Il sonne immédiatement à l'arrivée d'une commande, puis se
 * répète toutes les deux minutes tant qu'un élément attend une action, et
 * s'arrête dès que la file est vide. `router.refresh()` fait réapparaître la
 * nouvelle commande sur la page actuellement affichée (ex. la liste des
 * commandes) sans navigation.
 */

const POLL_INTERVAL_MS = 5_000;
const REMINDER_INTERVAL_MS = 120_000;

function beep(): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.1;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => void context.close();
  } catch {
    // Contexte audio indisponible (autoplay bloqué avant interaction) : le
    // badge de navigation reste le signal visuel de secours.
  }
}

/** Joue le son personnalisé du restaurant, ou le bip par défaut à défaut. */
function playAlertSound(customSoundUrl: string | null): void {
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

export function AlertWatcher() {
  const [count, setCount] = useState(0);
  const reminderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownOrderIds = useRef<Set<string> | null>(null);
  const soundUrlRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{
          total: number;
          orders: Array<{ id: string }>;
          notificationSoundUrl: string | null;
        }>('/api/alertes');
        if (cancelled) return;

        soundUrlRef.current = data.notificationSoundUrl;
        const currentIds = new Set(data.orders.map((order) => order.id));
        // `null` uniquement au tout premier appel : l'état initial ne doit
        // pas être confondu avec des commandes fraîchement arrivées.
        if (knownOrderIds.current) {
          const hasNewOrder = data.orders.some((order) => !knownOrderIds.current!.has(order.id));
          if (hasNewOrder) {
            playAlertSound(data.notificationSoundUrl);
            router.refresh();
          }
        }
        knownOrderIds.current = currentIds;
        setCount(data.total);
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
  }, [router]);

  useEffect(() => {
    if (reminderRef.current) {
      clearInterval(reminderRef.current);
      reminderRef.current = null;
    }
    if (count > 0) {
      reminderRef.current = setInterval(
        () => playAlertSound(soundUrlRef.current),
        REMINDER_INTERVAL_MS,
      );
    }
    return () => {
      if (reminderRef.current) clearInterval(reminderRef.current);
    };
  }, [count]);

  return null;
}
