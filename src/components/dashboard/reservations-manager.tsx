'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

type Reservation = {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedFor: string;
  notes: string | null;
  status: ReservationStatus;
  confirmationCode: string;
};

const STATUS_TONE: Record<ReservationStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Honorée',
};

/** Valeur par défaut d'un `<input type="datetime-local">` : demain, 19h00. */
function defaultReservationInput(): string {
  const date = new Date(Date.now() + 24 * 3_600_000);
  date.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReservationsManager({
  reservations,
  canManage,
  graceMinutes,
}: {
  reservations: Reservation[];
  canManage: boolean;
  /** Délai après l'heure de réservation avant de la signaler comme probable no-show. */
  graceMinutes: number;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Remonte le compte à rebours de retard minute par minute, sans dépendre
  // d'une action de l'utilisateur pour se rafraîchir.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming: Reservation[] = [];
    const past: Reservation[] = [];
    for (const reservation of reservations) {
      (new Date(reservation.reservedFor).getTime() >= now ? upcoming : past).push(reservation);
    }
    return { upcoming, past };
  }, [reservations]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    setFieldErrors({});

    // `noValidate` laisse passer un formulaire dont la date a été vidée :
    // sans ce contrôle, `new Date('').toISOString()` lèverait avant même
    // d'entrer dans le bloc try/catch.
    const reservedForDate = new Date(String(formData.get('reservedFor') ?? ''));
    if (Number.isNaN(reservedForDate.getTime())) {
      setFieldErrors({ reservedFor: 'Choisissez une date et une heure.' });
      setPending(false);
      return;
    }

    const payload = {
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      partySize: Number(formData.get('partySize') ?? 1),
      reservedFor: reservedForDate.toISOString(),
      notes: String(formData.get('notes') ?? ''),
    };

    try {
      await api.post('/api/reservations', payload);
      setCreating(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La réservation n'a pas pu être enregistrée.");
      }
    } finally {
      setPending(false);
    }
  }

  async function setStatus(reservation: Reservation, status: ReservationStatus) {
    setPendingId(reservation.id);
    setError(null);
    try {
      await api.patch(`/api/reservations/${reservation.id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La réservation n'a pas pu être mise à jour.");
    } finally {
      setPendingId(null);
    }
  }

  function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function ReservationRow({ reservation }: { reservation: Reservation }) {
    const isPendingOrConfirmed =
      reservation.status === 'PENDING' || reservation.status === 'CONFIRMED';
    const lateMinutes = isPendingOrConfirmed
      ? Math.floor((now - new Date(reservation.reservedFor).getTime()) / 60_000) - graceMinutes
      : -1;
    const isLate = lateMinutes > 0;

    return (
      <li className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{reservation.customerName}</span>
            <Badge tone={STATUS_TONE[reservation.status]}>
              {STATUS_LABEL[reservation.status]}
            </Badge>
            {isLate && (
              <Badge tone="danger">
                Retard {lateMinutes < 60 ? `${lateMinutes} min` : `${Math.floor(lateMinutes / 60)} h ${lateMinutes % 60}`}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {formatWhen(reservation.reservedFor)} · {reservation.partySize} personne
            {reservation.partySize > 1 ? 's' : ''} ·{' '}
            <a href={`tel:${reservation.customerPhone}`} className="underline underline-offset-4">
              {reservation.customerPhone}
            </a>
          </p>
          {reservation.notes && (
            <p className="mt-0.5 text-xs text-ink-faint">{reservation.notes}</p>
          )}
          <p className="mt-0.5 font-mono text-xs text-ink-faint">
            Code : {reservation.confirmationCode}
          </p>
        </div>

        {canManage && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {reservation.status === 'PENDING' && (
              <Button
                size="sm"
                disabled={pendingId === reservation.id}
                onClick={() => setStatus(reservation, 'CONFIRMED')}
              >
                Confirmer
              </Button>
            )}
            {(reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pendingId === reservation.id}
                  onClick={() => setStatus(reservation, 'COMPLETED')}
                >
                  Honorée
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pendingId === reservation.id}
                  onClick={() => setStatus(reservation, 'CANCELLED')}
                >
                  Annuler
                </Button>
              </>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {creating && canManage && (
        <Card className="mb-6 p-5">
          <h2 className="text-lg font-medium">Nouvelle réservation</h2>
          <form onSubmit={create} className="mt-5 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du client" htmlFor="customerName" required error={fieldErrors.customerName}>
                <input id="customerName" name="customerName" required className={inputClass} />
              </Field>
              <Field label="Téléphone" htmlFor="customerPhone" required error={fieldErrors.customerPhone}>
                <input id="customerPhone" name="customerPhone" required className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre de personnes" htmlFor="partySize" required error={fieldErrors.partySize}>
                <input
                  id="partySize"
                  name="partySize"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue={2}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Date et heure" htmlFor="reservedFor" required error={fieldErrors.reservedFor}>
                <input
                  id="reservedFor"
                  name="reservedFor"
                  type="datetime-local"
                  defaultValue={defaultReservationInput()}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Notes" htmlFor="notes" hint="Facultatif" error={fieldErrors.notes}>
              <input id="notes" name="notes" className={inputClass} placeholder="Anniversaire, allergie…" />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={pending}>
                Enregistrer
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">À venir</h2>
          {canManage && !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              Nouvelle réservation
            </Button>
          )}
        </div>

        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aucune réservation à venir"
              description="Les réservations prises depuis votre site public apparaîtront ici."
            />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-surface-border">
            {upcoming.map((reservation) => (
              <ReservationRow key={reservation.id} reservation={reservation} />
            ))}
          </ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card className="mt-6 p-4 sm:p-5">
          <h2 className="text-sm font-medium">Passées</h2>
          <ul className="mt-2 divide-y divide-surface-border">
            {past.map((reservation) => (
              <ReservationRow key={reservation.id} reservation={reservation} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
