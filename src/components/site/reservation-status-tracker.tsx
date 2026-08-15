'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/client/api';

/**
 * Suivi de réservation en temps réel, sur le même principe que le suivi de
 * commande : rendu initial depuis le serveur, puis sondage régulier pour
 * refléter une confirmation ou une annulation faite côté restaurant sans que
 * le client ait à recharger. S'arrête de lui-même une fois l'état terminal
 * atteint.
 */

const POLL_INTERVAL_MS = 8000;
type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
const TERMINAL_STATUSES: ReservationStatus[] = ['CANCELLED', 'COMPLETED'];

type ReservationSnapshot = {
  status: ReservationStatus;
  partySize: number;
  reservedFor: string;
  confirmationCode: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'En attente de confirmation',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Honorée',
};

export function ReservationStatusTracker({
  reservationId,
  restaurantName,
  initial,
}: {
  reservationId: string;
  restaurantName: string;
  initial: ReservationSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [connectionError, setConnectionError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let latestStatus = initial.status;

    async function poll() {
      try {
        const data = await api.get<ReservationSnapshot>(
          `/api/public/reservations/${reservationId}`,
        );
        if (cancelled) return;
        latestStatus = data.status;
        setSnapshot(data);
        setConnectionError(false);
      } catch {
        if (!cancelled) setConnectionError(true);
      }

      if (!cancelled && !TERMINAL_STATUSES.includes(latestStatus)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    if (!TERMINAL_STATUSES.includes(initial.status)) {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reservationId, initial.status]);

  async function cancelReservation() {
    const confirmed = window.confirm('Annuler cette réservation ?');
    if (!confirmed) return;

    setCancelling(true);
    setCancelError(null);
    try {
      const data = await api.delete<ReservationSnapshot>(
        `/api/public/reservations/${reservationId}`,
      );
      setSnapshot(data);
    } catch (err) {
      setCancelError(
        err instanceof ApiError ? err.message : "L'annulation n'a pas pu être enregistrée.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const isLive = !TERMINAL_STATUSES.includes(snapshot.status);
  const when = new Date(snapshot.reservedFor).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const canCancel = snapshot.status === 'PENDING' || snapshot.status === 'CONFIRMED';

  return (
    <div className="rounded-2xl border border-surface-border p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">Votre réservation chez {restaurantName}</h1>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs text-ink-faint">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
            />
            En direct
          </span>
        )}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">{STATUS_LABEL[snapshot.status]}</p>
      <p className="mt-1 text-sm text-ink-muted">
        {when} · {snapshot.partySize} personne{snapshot.partySize > 1 ? 's' : ''}
      </p>

      {snapshot.status !== 'CANCELLED' && (
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-sunken p-3">
          <p className="text-xs text-ink-muted">Code à présenter sur place</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tracking-widest">
            {snapshot.confirmationCode}
          </p>
        </div>
      )}

      {connectionError && (
        <p role="status" className="mt-3 text-xs text-amber-700">
          Connexion instable — nouvelle tentative en cours.
        </p>
      )}

      {cancelError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {cancelError}
        </p>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={cancelReservation}
          disabled={cancelling}
          className="mt-5 inline-flex h-11 items-center rounded-xl border border-surface-border px-5 text-sm font-medium text-ink-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelling ? 'Annulation…' : 'Annuler ma réservation'}
        </button>
      )}
    </div>
  );
}
