'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card } from '@/components/ui';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Liste des notifications — Core, partagé entre Restaurant et Boutique
 * (`/api/restaurant/notifications`, `/api/boutique/notifications`, même
 * forme des deux côtés). Seul l'`endpoint` diffère par produit.
 */
export function NotificationsPanel({
  notifications,
  endpoint,
}: {
  notifications: NotificationItem[];
  endpoint: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    setPending(id);
    setError(null);
    try {
      await api.patch(endpoint, { id });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de marquer cette notification comme lue.');
    } finally {
      setPending(null);
    }
  }

  async function markAllRead() {
    setPending('all');
    setError(null);
    try {
      await api.patch(endpoint, { markAll: true });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de marquer les notifications comme lues.');
    } finally {
      setPending(null);
    }
  }

  if (notifications.length === 0) {
    return (
      <Card className="p-5 text-center text-sm text-ink-muted">
        Aucune notification pour le moment.
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
          {error}
        </p>
      )}

      {unreadCount > 0 && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="secondary" loading={pending === 'all'} onClick={markAllRead}>
            Tout marquer comme lu
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <Card className={`p-4 ${notification.readAt ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {notification.title}
                    {!notification.readAt && <Badge tone="info">Nouveau</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{notification.body}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {new Date(notification.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {notification.href && (
                    <Link
                      href={notification.href}
                      className="mt-1 inline-block text-sm text-brand underline underline-offset-4"
                    >
                      Voir
                    </Link>
                  )}
                </div>
                {!notification.readAt && (
                  <button
                    type="button"
                    onClick={() => markRead(notification.id)}
                    disabled={pending === notification.id}
                    className="shrink-0 text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
                  >
                    Marquer comme lu
                  </button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
