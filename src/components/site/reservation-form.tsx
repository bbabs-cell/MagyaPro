'use client';

import { useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { Field, inputClass } from '@/components/ui';

type ReservationResult = {
  reservation: { id: string; confirmationCode: string; reservedFor: string };
};

/** Valeur par défaut du champ date/heure : demain, 19h00. */
function defaultReservationInput(): string {
  const date = new Date(Date.now() + 24 * 3_600_000);
  date.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReservationForm({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<ReservationResult['reservation'] | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      restaurantId,
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      partySize: Number(formData.get('partySize') ?? 1),
      reservedFor: reservedForDate.toISOString(),
      notes: String(formData.get('notes') ?? ''),
    };

    try {
      const result = await api.post<ReservationResult>('/api/public/reservations', payload);
      setConfirmation(result.reservation);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La réservation n'a pas pu être envoyée.");
      }
    } finally {
      setPending(false);
    }
  }

  if (confirmation) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-medium text-emerald-900">Demande envoyée</p>
        <p className="mt-1 text-sm text-emerald-800">
          {restaurantName} doit encore confirmer votre réservation du{' '}
          {new Date(confirmation.reservedFor).toLocaleString('fr-FR', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
          .
        </p>
        <p className="mt-3 font-mono text-lg font-semibold text-emerald-900">
          {confirmation.confirmationCode}
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          Conservez ce code, il vous sera demandé sur place.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="customerName" required error={fieldErrors.customerName}>
          <input id="customerName" name="customerName" required autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Téléphone" htmlFor="customerPhone" required error={fieldErrors.customerPhone}>
          <input
            id="customerPhone"
            name="customerPhone"
            required
            autoComplete="tel"
            className={inputClass}
          />
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-6 font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? 'Envoi…' : 'Demander la réservation'}
      </button>
    </form>
  );
}
