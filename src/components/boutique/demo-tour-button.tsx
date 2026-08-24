'use client';

import { useState } from 'react';

import { ApiError, api } from '@/lib/client/api';

/**
 * Démarre une visite guidée du tableau de bord d'une boutique de
 * démonstration (voir `getDemoTourContext`) — un visiteur du site public
 * clique, sans créer de compte ni saisir de mot de passe.
 */
export function DemoTourButton({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>('/api/public/boutique/demo-tour', { slug });
      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La visite guidée n'a pas pu démarrer.");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={pending} className={className}>
        {pending ? 'Ouverture…' : children}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
