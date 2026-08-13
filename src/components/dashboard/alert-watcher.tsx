'use client';

import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/client/api';

/**
 * Rappel sonore du centre d'alertes.
 *
 * Un simple bip généré par le navigateur (Web Audio API) : pas de fichier
 * audio à charger, ce qui fonctionne dès l'installation. Il se répète toutes
 * les deux minutes tant qu'un élément attend une action, et s'arrête dès que
 * la file est vide.
 */

const POLL_INTERVAL_MS = 30_000;
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

export function AlertWatcher() {
  const [count, setCount] = useState(0);
  const reminderRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{ total: number }>('/api/alertes');
        if (!cancelled) setCount(data.total);
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
  }, []);

  useEffect(() => {
    if (reminderRef.current) {
      clearInterval(reminderRef.current);
      reminderRef.current = null;
    }
    if (count > 0) {
      reminderRef.current = setInterval(beep, REMINDER_INTERVAL_MS);
    }
    return () => {
      if (reminderRef.current) clearInterval(reminderRef.current);
    };
  }, [count]);

  return null;
}
