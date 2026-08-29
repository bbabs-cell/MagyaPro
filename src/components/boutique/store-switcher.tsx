'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import type { StoreRole } from '@prisma/client';
import { cx } from '@/components/ui';

type StoreOption = { id: string; name: string; role: StoreRole };

/**
 * Bascule entre les boutiques d'un même compte — un utilisateur peut
 * appartenir à plusieurs (`StoreUser`). N'affiche rien de plus qu'un simple
 * libellé si le compte n'a qu'une seule boutique.
 */
export function StoreSwitcher({
  currentStoreId,
  currentStoreName,
  stores,
  canAddStore = false,
}: {
  currentStoreId: string;
  currentStoreName: string;
  stores: StoreOption[];
  /** Vrai pour le propriétaire : lui seul peut ouvrir une boutique de plus. */
  canAddStore?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Une seule boutique : rien à sélectionner, mais le propriétaire doit
  // pouvoir en ouvrir une deuxième. C'est précisément le compte qui n'a qu'une
  // boutique qui a besoin de trouver cette porte.
  if (stores.length <= 1) {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-surface-raised/5 p-3">
        <p className="truncate text-sm font-medium">{currentStoreName}</p>
        <p className="mt-0.5 truncate text-xs text-white/40">MagyaPro Boutique</p>
        {canAddStore && (
          <Link
            href="/boutique/dashboard/nouvelle-boutique"
            className="mt-2.5 block text-xs font-medium text-white/60 transition-colors hover:text-white"
          >
            + Ajouter une boutique
          </Link>
        )}
      </div>
    );
  }

  async function switchTo(storeId: string) {
    if (storeId === currentStoreId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/switch-store', { storeId });
      router.push('/boutique/dashboard');
      router.refresh();
      setOpen(false);
    } catch (err) {
      // Échec explicite plutôt que silencieux : sans ce message, l'écran se
      // referme et l'utilisateur reste sur la mauvaise boutique sans le
      // savoir — risque réel de vente ou commande enregistrée au mauvais
      // endroit.
      setError(err instanceof ApiError ? err.message : 'Impossible de changer de boutique. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={ref} className="relative mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={pending}
        className="w-full rounded-xl border border-white/10 bg-surface-raised/5 p-3 text-left transition-colors hover:bg-white/10"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{currentStoreName}</span>
            <span className="block truncate text-xs text-white/40">MagyaPro Boutique</span>
          </span>
          <span aria-hidden="true" className={cx('shrink-0 text-white/40 transition-transform', open && 'rotate-180')}>
            ▾
          </span>
        </span>
      </button>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      )}

      {open && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-navy p-1 shadow-lg">
          {stores.map((store) => (
            <li key={store.id}>
              <button
                type="button"
                onClick={() => switchTo(store.id)}
                className={cx(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                  store.id === currentStoreId ? 'bg-surface-raised/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className="truncate">{store.name}</span>
                <span className="shrink-0 text-xs text-white/40">{STORE_ROLE_LABELS[store.role]}</span>
              </button>
            </li>
          ))}
          {canAddStore && (
            <li className="mt-1 border-t border-white/10 pt-1">
              <Link
                href="/boutique/dashboard/nouvelle-boutique"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                + Ajouter une boutique
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
