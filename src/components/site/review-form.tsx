'use client';

import { useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { Field, inputClass } from '@/components/ui';

export function ReviewForm({
  restaurantId,
  orderId,
}: {
  restaurantId: string;
  orderId: string;
}) {
  const [rating, setRating] = useState(5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      restaurantId,
      orderId,
      customerName: String(formData.get('customerName') ?? ''),
      rating,
      comment: String(formData.get('comment') ?? ''),
    };

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      await api.post('/api/public/avis', payload);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("L'avis n'a pas pu être envoyé.");
      }
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-medium text-emerald-900">Merci pour votre avis</p>
        <p className="mt-1 text-sm text-emerald-800">
          Il sera visible sur le site une fois validé par le restaurant.
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

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink">Note</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              onClick={() => setRating(value)}
              className="text-3xl leading-none"
            >
              <span className={value <= rating ? 'text-amber-500' : 'text-surface-border'}>
                ★
              </span>
              <span className="sr-only">{value} sur 5</span>
            </button>
          ))}
        </div>
        {fieldErrors.rating && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {fieldErrors.rating}
          </p>
        )}
      </fieldset>

      <Field label="Votre nom" htmlFor="customerName" required error={fieldErrors.customerName}>
        <input id="customerName" name="customerName" required autoComplete="name" className={inputClass} />
      </Field>

      <Field label="Commentaire" htmlFor="comment" hint="Facultatif" error={fieldErrors.comment}>
        <textarea id="comment" name="comment" rows={4} className={inputClass} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-6 font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? 'Envoi…' : "Envoyer l'avis"}
      </button>
    </form>
  );
}
