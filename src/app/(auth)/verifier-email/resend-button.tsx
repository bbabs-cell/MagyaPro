'use client';

import { useState } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { Button } from '@/components/ui';

export function ResendVerificationButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setPending(true);
    setMessage(null);
    try {
      await api.post('/api/auth/resend-verification');
      setMessage('Email envoyé. Pensez à vérifier vos spams.');
    } catch (err) {
      setMessage(
        err instanceof ApiError
          ? err.message
          : "L'envoi a échoué. Réessayez dans quelques instants.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <Button type="button" variant="secondary" loading={pending} onClick={resend}>
        Renvoyer l&apos;email de vérification
      </Button>
      {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
    </div>
  );
}
