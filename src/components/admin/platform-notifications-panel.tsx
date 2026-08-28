'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Notifications de l'espace Super Admin.
 *
 * Composant propre à l'administration plutôt que le `NotificationsPanel`
 * partagé : l'admin n'utilise pas les jetons `ink`/`surface` du produit, ses
 * classes sont pensées pour un fond sombre (voir `admin/theme-root.tsx`).
 */

type PlatformNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function PlatformNotificationsPanel({
  notifications,
}: {
  notifications: PlatformNotification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unread = notifications.filter((notification) => !notification.readAt).length;

  async function markRead(id?: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/admin/notifications', id ? { id } : { markAll: true });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La notification n’a pas pu être marquée.');
    } finally {
      setBusy(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-white/20 p-10 text-center text-sm text-white/60">
        Aucune notification. Les paiements d’abonnement à valider apparaîtront ici.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {unread > 0 && (
        <button
          type="button"
          onClick={() => markRead()}
          disabled={busy}
          className="mb-4 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          Tout marquer comme lu ({unread})
        </button>
      )}

      <ul className="divide-y divide-white/10">
        {notifications.map((notification) => (
          <li key={notification.id} className="flex items-start gap-3 py-4">
            <span
              aria-hidden="true"
              className={
                notification.readAt
                  ? 'mt-2 h-2 w-2 shrink-0 rounded-full bg-white/15'
                  : 'mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400'
              }
            />
            <div className="min-w-0 flex-1">
              <p className={notification.readAt ? 'text-sm text-white/60' : 'text-sm font-medium'}>
                {notification.title}
              </p>
              <p className="mt-0.5 text-sm text-white/50">{notification.body}</p>
              <p className="mt-1 text-xs text-white/35">
                {new Date(notification.createdAt).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {notification.href && (
                <Link
                  href={notification.href}
                  className="text-xs text-amber-300 underline underline-offset-2"
                >
                  Ouvrir
                </Link>
              )}
              {!notification.readAt && (
                <button
                  type="button"
                  onClick={() => markRead(notification.id)}
                  disabled={busy}
                  className="text-xs text-white/50 hover:text-white disabled:opacity-50"
                >
                  Marquer lu
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
