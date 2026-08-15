'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planKey = searchParams.get('plan') || undefined;
  const planName = searchParams.get('planNom');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    try {
      const result = await api.post<{ redirectTo: string }>('/api/auth/register', {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        restaurantName: String(formData.get('restaurantName') ?? ''),
        planKey,
      });

      // `refresh()` recharge les composants serveur pour qu'ils voient la
      // nouvelle session avant la navigation.
      router.replace(result.redirectTo);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setFormError("Une erreur inattendue s'est produite. Réessayez.");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {planName && (
        <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand">
          Plan sélectionné : {planName}
        </p>
      )}

      {formError && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </div>
      )}

      <Field label="Votre nom" htmlFor="name" required error={fieldErrors.name}>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className={inputClass}
          placeholder="Fatou Diallo"
        />
      </Field>

      <Field
        label="Nom du restaurant"
        htmlFor="restaurantName"
        required
        hint="Modifiable à tout moment."
        error={fieldErrors.restaurantName}
      >
        <input
          id="restaurantName"
          name="restaurantName"
          type="text"
          required
          className={inputClass}
          placeholder="Chez Fatou"
        />
      </Field>

      <Field label="Adresse email" htmlFor="email" required error={fieldErrors.email}>
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

      <Field
        label="Mot de passe"
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

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Création en cours…' : 'Créer mon compte'}
      </Button>
    </form>
  );
}
