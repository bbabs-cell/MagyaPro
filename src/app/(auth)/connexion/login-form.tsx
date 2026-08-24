'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Présent uniquement après un mot de passe validé sur un compte protégé
  // par la 2FA — la connexion attend alors un second formulaire (le code),
  // jamais une session tant qu'il n'a pas réussi.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await api.post<{ redirectTo?: string; requiresTotp?: boolean; pendingToken?: string }>(
        '/api/auth/login',
        {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
          turnstileToken: turnstileToken ?? undefined,
        },
      );
      if (result.requiresTotp && result.pendingToken) {
        setPendingToken(result.pendingToken);
        setPending(false);
        return;
      }
      // Navigation complète (pas le routeur client) : le cookie de session
      // vient d'être posé par la réponse, et le cache de routage de Next.js
      // peut avoir gardé en mémoire le rendu de cette page d'avant la
      // connexion (ex. une redirection vers /connexion pour visiteur anonyme)
      // — le servir tel quel laisse le bouton tourner sans jamais arriver.
      window.location.assign(result.redirectTo!);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Une erreur inattendue s'est produite. Réessayez.",
      );
      setPending(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);

    try {
      const result = await api.post<{ redirectTo: string }>('/api/auth/2fa/verify-login', {
        pendingToken,
        code,
      });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Une erreur inattendue s'est produite. Réessayez.",
      );
      setPending(false);
    }
  }

  if (pendingToken) {
    return (
      <form onSubmit={handleVerifyCode} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </div>
        )}

        <Field label="Code de vérification" htmlFor="code" required>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="123456 ou un code de secours"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClass}
          />
        </Field>
        <p className="text-sm text-ink-muted">
          Ouvrez votre application d&apos;authentification, ou saisissez l&apos;un de vos codes de
          secours si vous avez perdu votre téléphone.
        </p>

        <Button type="submit" disabled={pending || !code.trim()} className="w-full" size="lg">
          {pending ? 'Vérification…' : 'Valider'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setPendingToken(null);
            setCode('');
            setFormError(null);
          }}
          className="w-full text-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Retour
        </button>
      </form>
    );
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

      {turnstileSiteKey && (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      )}

      <Button
        type="submit"
        disabled={pending || (Boolean(turnstileSiteKey) && !turnstileToken)}
        className="w-full"
        size="lg"
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
