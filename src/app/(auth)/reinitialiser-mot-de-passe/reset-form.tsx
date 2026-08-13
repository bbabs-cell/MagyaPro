'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');

    // Vérification de correspondance côté client : c'est une aide à la saisie,
    // la validation qui fait foi reste celle du serveur.
    if (password !== String(formData.get('confirm') ?? '')) {
      setFieldErrors({ confirm: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      await api.post('/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Une erreur inattendue s'est produite. Réessayez.");
      }
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <div
          role="status"
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Votre mot de passe a été modifié. Toutes vos sessions ouvertes ont été
          fermées par sécurité.
        </div>
        <Link
          href="/connexion"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90"
        >
          Se connecter
        </Link>
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

      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        required
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        error={fieldErrors.password}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          className={inputClass}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="confirm"
        required
        error={fieldErrors.confirm}
      >
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Enregistrement…' : 'Changer mon mot de passe'}
      </Button>
    </form>
  );
}
