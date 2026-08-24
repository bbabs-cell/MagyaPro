'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Données de démonstration MagyaPro Boutique — génère (ou retire) les 4
 * boutiques fictives par secteur (`seedStoreDemos`/`cleanStoreDemos`),
 * réservé au Super Admin. Aucun accès shell/base n'étant possible en dehors
 * de l'application déployée, ce bouton est le seul moyen d'exécuter cette
 * opération en production.
 */
export function BoutiqueDemoPanel({ demoCount }: { demoCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<'seed' | 'clean' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setPending('seed');
    setError(null);
    setMessage(null);
    try {
      const result = await api.post<{ created: string[]; skipped: string[] }>('/api/admin/boutique-demo');
      const parts: string[] = [];
      if (result.created.length > 0) parts.push(`créées : ${result.created.join(', ')}`);
      if (result.skipped.length > 0) parts.push(`déjà présentes : ${result.skipped.join(', ')}`);
      setMessage(parts.length > 0 ? parts.join(' — ') : 'Aucune boutique à créer.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La création a échoué.');
    } finally {
      setPending(null);
    }
  }

  async function clean() {
    if (!window.confirm('Retirer toutes les boutiques de démonstration ? Cette action est irréversible.')) {
      return;
    }
    setPending('clean');
    setError(null);
    setMessage(null);
    try {
      const result = await api.delete<{ deletedStores: number; deletedUsers: number }>('/api/admin/boutique-demo');
      setMessage(`${result.deletedStores} boutique(s) de démonstration supprimée(s).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La suppression a échoué.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">Données de démonstration</h2>
          <p className="mt-0.5 text-white/60">
            {demoCount > 0
              ? `${demoCount} boutique(s) de démonstration actuellement en ligne.`
              : 'Aucune boutique de démonstration en ligne.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={seed}
            disabled={pending !== null}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-white/90 disabled:opacity-60"
          >
            {pending === 'seed' ? 'Création…' : 'Créer (une par secteur)'}
          </button>
          {demoCount > 0 && (
            <button
              type="button"
              onClick={clean}
              disabled={pending !== null}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-60"
            >
              {pending === 'clean' ? 'Suppression…' : 'Retirer'}
            </button>
          )}
        </div>
      </div>
      {message && <p className="mt-2 text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-red-400">{error}</p>}
    </div>
  );
}
