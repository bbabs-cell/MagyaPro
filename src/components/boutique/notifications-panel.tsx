'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { api } from '@/lib/client/api';
import { Badge, Button, Card } from '@/components/ui';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsPanel({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    setPending(id);
    try {
      await api.patch('/api/boutique/notifications', { id });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function markAllRead() {
    setPending('all');
    try {
      await api.patch('/api/boutique/notifications', { markAll: true });
      router.refresh();
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
