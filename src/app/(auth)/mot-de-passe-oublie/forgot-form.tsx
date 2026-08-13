'use client';

import { useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await api.post<{ message: string }>(
        '/api/auth/forgot-password',
        { email: String(formData.get('email') ?? '') },
      );
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Une erreur inattendue s'est produite. Réessayez.",
      );
    } finally {
      setPending(false);
    }
  }

  if (message) {
    return (
      <div
        role="status"
        className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Field label="Adresse email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder="vous@exemple.com"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Envoi…' : 'Envoyer le lien'}
      </Button>
    </form>
  );
}
