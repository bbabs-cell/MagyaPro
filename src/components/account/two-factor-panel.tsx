'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card, inputClass } from '@/components/ui';

type Step = 'idle' | 'enrolling' | 'confirmed';

/**
 * Authentification à deux facteurs (TOTP) — composant Core, partagé entre
 * Restaurant et Boutique (`/api/auth/2fa/*`, `src/lib/auth/service.ts` ne
 * connaissent que l'utilisateur, jamais un tenant) ; seule la page qui
 * l'utilise diffère par produit.
 */
export function TwoFactorPanel({ enabled: initialEnabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEnrollment() {
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ secret: string; qrDataUrl: string }>('/api/auth/2fa/enroll');
      setSecret(result.secret);
      setQrDataUrl(result.qrDataUrl);
      setStep('enrolling');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enrôlement n'a pas pu démarrer.");
    } finally {
      setPending(false);
    }
  }

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ backupCodes: string[] }>('/api/auth/2fa/confirm', { code });
      setBackupCodes(result.backupCodes);
      setEnabled(true);
      setStep('confirmed');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide.');
    } finally {
      setPending(false);
    }
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/api/auth/2fa/disable', { password });
      setEnabled(false);
      setStep('idle');
      setPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La désactivation a échoué.');
    } finally {
      setPending(false);
    }
  }

  if (step === 'confirmed' && backupCodes) {
    return (
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">Vérification en deux étapes activée</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Conservez ces codes de secours dans un endroit sûr — chacun ne fonctionne qu&apos;une fois,
          et permet de vous connecter si vous perdez l&apos;accès à votre application
          d&apos;authentification. Ils ne seront plus jamais affichés.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-sunken p-4 font-mono text-sm sm:grid-cols-4">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button className="mt-4" size="sm" onClick={() => setStep('idle')}>
          J&apos;ai noté mes codes
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Vérification en deux étapes</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ajoute un code à usage unique (application d&apos;authentification) à la connexion, en plus
        du mot de passe.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
          {error}
        </div>
      )}

      {enabled && step === 'idle' && (
        <form onSubmit={disable} className="mt-4 space-y-3">
          <p className="text-sm font-medium text-state-ok">Activée sur ce compte.</p>
          <label htmlFor="disable-password" className="block text-sm font-medium text-ink">
            Mot de passe (pour désactiver)
          </label>
          <input
            id="disable-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className={inputClass}
          />
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            Désactiver
          </Button>
        </form>
      )}

      {!enabled && step === 'idle' && (
        <Button className="mt-4" size="sm" loading={pending} onClick={startEnrollment}>
          Activer
        </Button>
      )}

      {step === 'enrolling' && (
        <div className="mt-4">
          <p className="text-sm text-ink">
            Scannez ce code avec votre application d&apos;authentification (Google Authenticator,
            Authy...), ou saisissez la clé manuellement.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré localement, jamais une image distante */}
          <img src={qrDataUrl} alt="QR code de configuration" className="mt-3 h-48 w-48 rounded-xl border border-surface-border" />
          <p className="mt-2 break-all font-mono text-xs text-ink-faint">{secret}</p>

          <form onSubmit={confirmEnrollment} className="mt-4 flex flex-wrap items-end gap-2">
            <label htmlFor="confirm-code" className="sr-only">
              Code de vérification
            </label>
            <input
              id="confirm-code"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              className={`${inputClass} max-w-40`}
            />
            <Button type="submit" size="sm" loading={pending} disabled={!code.trim()}>
              Confirmer
            </Button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Annuler
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
