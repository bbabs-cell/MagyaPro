'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Ligne utilisateur avec suspension / réactivation.
 *
 * Un administrateur ne peut pas se suspendre lui-même : le bouton est absent,
 * et la route refuserait de toute façon.
 */
export function UserRow({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: string;
    status: string;
    emailVerified: boolean;
    lastLoginAt: string | null;
    restaurants: string[];
  };
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus() {
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    if (
      next === 'SUSPENDED' &&
      !window.confirm(
        `Suspendre ${user.email} ? Ses sessions seront fermées immédiatement.`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/admin/utilisateurs/${user.id}`, { status: next });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-b border-white/10">
      <td data-label="Utilisateur" className="py-3 pr-3">
        <span className="block font-medium">
          {user.name}
          {user.platformRole === 'SUPER_ADMIN' && (
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
              Super Admin
            </span>
          )}
        </span>
        <span className="block break-all text-xs text-white/40">
          {user.email}
          {!user.emailVerified && ' · non vérifié'}
        </span>
        {error && (
          <span role="alert" className="mt-1 block text-xs text-red-300">
            {error}
          </span>
        )}
      </td>

      <td data-label="Restaurants" className="py-3 pr-3 text-white/70">
        {user.restaurants.length === 0 ? '—' : user.restaurants.join(', ')}
      </td>

      <td data-label="Dernière connexion" className="py-3 pr-3 text-white/60">
        {user.lastLoginAt
          ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR')
          : 'Jamais'}
      </td>

      <td data-label="Statut" className="py-3">
        <div className="flex items-center justify-end gap-2 sm:justify-start">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              user.status === 'ACTIVE'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {user.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
          </span>

          {!isSelf && (
            <button
              type="button"
              disabled={pending}
              onClick={toggleStatus}
              className="rounded-lg border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              {user.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
