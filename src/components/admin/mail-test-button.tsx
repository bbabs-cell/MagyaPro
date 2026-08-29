'use client';

import { useState } from 'react';

import { ApiError, api } from '@/lib/client/api';

/**
 * Envoie un email de test à l'adresse du Super Admin connecté.
 *
 * L'état affiché à côté ne vérifie que la présence des réglages. Une clé d'API
 * révoquée, un domaine d'expédition non vérifié ou un mot de passe SMTP périmé
 * passent ce contrôle sans problème et échouent pourtant à l'envoi — seul un
 * envoi réel tranche.
 */
export function MailTestButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ sent: boolean; message: string } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    try {
      const data = await api.post<{ sent: boolean; message: string }>('/api/admin/test-email');
      setResult(data);
    } catch (error) {
      setResult({
        sent: false,
        message: error instanceof ApiError ? error.message : 'La requête a échoué.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60"
      >
        {pending ? 'Envoi…' : 'Envoyer un test'}
      </button>
      {result ? (
        <p
          role="status"
          className={`mt-2 max-w-xs text-xs ${result.sent ? 'text-emerald-300' : 'text-red-300'}`}
        >
          <span aria-hidden="true">{result.sent ? '✓' : '✕'}</span> {result.message}
        </p>
      ) : null}
    </div>
  );
}
