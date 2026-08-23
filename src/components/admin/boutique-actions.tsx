'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Actions d'administration sur une boutique — copie de
 * `restaurant-actions.tsx`, sans l'accès support (sous-système propre à
 * Restaurant, pas encore répliqué côté Boutique) : seulement suspendre/
 * réactiver et supprimer, avec les mêmes garde-fous.
 */
export function BoutiqueAdminActions({
  store,
}: {
  store: {
    id: string;
    name: string;
    status: string;
    salesCount: number;
  };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'support' | 'suspend' | 'delete'>('idle');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode('idle');
    setReason('');
    setConfirmation('');
    setError(null);
  }

  async function startSupport() {
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ redirectTo: string }>('/api/admin/boutique-support-access', {
        storeId: store.id,
        reason,
      });
      router.push(result.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'accès support a échoué.");
      setPending(false);
    }
  }

  async function changeStatus(status: 'ACTIVE' | 'SUSPENDED') {
    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/admin/boutiques/${store.id}`, {
        status,
        reason: reason || undefined,
      });
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le statut n'a pas pu être changé.");
    } finally {
      setPending(false);
    }
  }

  async function destroy() {
    setPending(true);
    setError(null);
    try {
      await fetch(`/api/admin/boutiques/${store.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      }).then(async (response) => {
        const payload = (await response.json()) as
          | { ok: true }
          | { ok: false; error: { message: string; code: string } };
        if (!payload.ok) {
          throw new ApiError(payload.error.message, response.status, payload.error.code);
        }
      });
      router.push('/admin/boutiques');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La suppression a échoué.');
      setPending(false);
    }
  }

  const inputStyle =
    'w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40';
  const buttonStyle =
    'rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('support')}
            className={`${buttonStyle} bg-white text-ink hover:bg-white/90`}
          >
            Accès support
          </button>

          {store.status === 'SUSPENDED' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus('ACTIVE')}
              className={`${buttonStyle} bg-white text-ink hover:bg-white/90`}
            >
              Réactiver
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('suspend')}
              className={`${buttonStyle} border border-white/20 hover:bg-white/10`}
            >
              Suspendre
            </button>
          )}

          <button
            type="button"
            onClick={() => setMode('delete')}
            className={`${buttonStyle} border border-red-500/40 text-red-300 hover:bg-red-500/10`}
          >
            Supprimer
          </button>
        </div>
      )}

      {mode === 'support' && (
        <div className="space-y-3">
          <label htmlFor="support-reason" className="block text-sm">
            Motif de l&apos;accès
            <span className="mt-1 block text-xs text-white/50">
              Consigné au journal avec votre identité et la durée de la session.
              Le commerçant voit un bandeau pendant toute la durée de l&apos;accès.
            </span>
          </label>
          <input
            id="support-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Demande d'aide du client sur la configuration du catalogue"
            className={inputStyle}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || reason.trim().length < 10}
              onClick={startSupport}
              className={`${buttonStyle} bg-white text-ink hover:bg-white/90`}
            >
              {pending ? 'Ouverture…' : "Ouvrir l'accès support"}
            </button>
            <button type="button" onClick={reset} className={`${buttonStyle} text-white/60`}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === 'suspend' && (
        <div className="space-y-3">
          <label htmlFor="suspend-reason" className="block text-sm">
            Motif de la suspension
            <span className="mt-1 block text-xs text-white/50">
              Le site public passe hors ligne et les modifications sont bloquées.
              Aucune donnée n&apos;est supprimée.
            </span>
          </label>
          <input
            id="suspend-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Impayé, contenu non conforme…"
            className={inputStyle}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || reason.trim().length === 0}
              onClick={() => changeStatus('SUSPENDED')}
              className={`${buttonStyle} bg-red-500 text-white hover:bg-red-600`}
            >
              {pending ? 'Suspension…' : 'Suspendre la boutique'}
            </button>
            <button type="button" onClick={reset} className={`${buttonStyle} text-white/60`}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === 'delete' && (
        <div className="space-y-3 rounded-xl border border-red-500/40 p-4">
          <p className="text-sm font-medium text-red-200">Suppression définitive</p>
          <p className="text-sm text-white/70">
            Cette action supprime la boutique, son catalogue, ses{' '}
            {store.salesCount} vente
            {store.salesCount > 1 ? 's' : ''}, ses clients et son historique.
            Elle est irréversible et ne peut pas être annulée.
          </p>
          {store.status !== 'SUSPENDED' && (
            <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
              La boutique doit être suspendue avant de pouvoir être supprimée.
            </p>
          )}

          <label htmlFor="confirmation" className="block text-sm">
            Saisissez « {store.name} » pour confirmer
          </label>
          <input
            id="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={inputStyle}
            autoComplete="off"
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || confirmation !== store.name || store.status !== 'SUSPENDED'}
              onClick={destroy}
              className={`${buttonStyle} bg-red-500 text-white hover:bg-red-600`}
            >
              {pending ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
            <button type="button" onClick={reset} className={`${buttonStyle} text-white/60`}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
