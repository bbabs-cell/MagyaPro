'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await api.post<{ redirectTo: string }>('/api/auth/login', {
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
      });
      router.replace(result.redirectTo);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Une erreur inattendue s'est produite. Réessayez.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
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

      <Field label="Mot de passe" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      <div className="text-right">
        <Link
          href="/mot-de-passe-oublie"
          className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
