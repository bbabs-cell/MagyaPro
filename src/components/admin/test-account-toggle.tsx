'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * « Compte de test » : exclut ce commerce de la recette, des statistiques et
 * des compteurs de la plateforme. Rien d'autre ne change pour lui — voir
 * `lib/admin/test-accounts.ts`.
 *
 * Un compte de démonstration est déjà exclu : la carte le dit simplement, sans
 * interrupteur.
 */
export function TestAccountToggle({
  kind,
  id,
  isTest,
  isDemo,
}: {
  kind: 'restaurant' | 'boutique';
  id: string;
  isTest: boolean;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(isTest);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = kind === 'restaurant' ? 'Ce restaurant' : 'Cette boutique';

  async function toggle() {
    const next = !value;
    setPending(true);
    setError(null);
    try {
      await api.put(`/api/admin/${kind === 'restaurant' ? 'restaurants' : 'boutiques'}/${id}/test`, {
        isTest: next,
      });
      setValue(next);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le changement n'a pas pu être enregistré.");
    } finally {
      setPending(false);
    }
  }

  if (isDemo) {
    return (
      <p className="rounded-2xl border border-fg/10 bg-fg/5 p-4 text-sm text-fg/70">
        {noun} est un compte de démonstration : ses ventes et ses abonnements ne comptent dans
        aucun chiffre de la plateforme.
      </p>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${value ? 'border-amber-500/40 bg-amber-500/10' : 'border-fg/10 bg-fg/5'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-medium">
            {value ? 'Compte de test — exclu des chiffres' : 'Compté dans les chiffres de la plateforme'}
          </p>
          <p className="mt-1 text-sm text-fg/65">
            {value
              ? `${noun} n'entre ni dans la recette, ni dans les statistiques, ni dans le nombre d'utilisateurs. Il fonctionne normalement par ailleurs.`
              : `Marquez-le comme compte de test s'il a été ouvert pour essayer le produit : ses chiffres ne se mélangeront plus à ceux des vrais clients.`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="shrink-0 rounded-xl border border-fg/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-fg/10 disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : value ? 'Remettre dans les chiffres' : 'Marquer comme compte de test'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-state-bad">
          {error}
        </p>
      )}
    </div>
  );
}
