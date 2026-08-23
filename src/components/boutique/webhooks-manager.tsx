'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, cx } from '@/components/ui';

type Webhook = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
};

const EVENT_LABELS: Record<string, string> = {
  SALE_CREATED: 'Vente enregistrée',
  ORDER_CREATED: 'Nouvelle commande en ligne',
  ORDER_STATUS_CHANGED: 'Statut de commande modifié',
  LOW_STOCK: 'Stock faible',
};

/** Webhooks sortants — voir `src/lib/boutique/webhooks.ts` pour la livraison et la signature. */
export function WebhooksManager({ webhooks, canManage }: { webhooks: Webhook[]; canManage: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setEvents((current) =>
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event],
    );
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (events.length === 0) {
      setError('Sélectionnez au moins un événement.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ secret: string }>('/api/boutique/webhooks', { url, events });
      setRevealedSecret(result.secret);
      setUrl('');
      setEvents([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le webhook n'a pas pu être créé.");
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(webhook: Webhook) {
    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/boutique/webhooks/${webhook.id}`, { isActive: !webhook.isActive });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La mise à jour a échoué.');
    } finally {
      setPending(false);
    }
  }

  async function remove(webhook: Webhook) {
    if (!window.confirm(`Supprimer ce webhook (${webhook.url}) ?`)) return;
    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/boutique/webhooks/${webhook.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La suppression a échoué.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Webhooks</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Notifie une URL de votre choix sur certains événements — chaque envoi est signé (en-tête{' '}
        <span className="font-mono">X-Magyapro-Signature</span>, HMAC-SHA256 avec le secret ci-dessous).
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {revealedSecret && (
        <div role="status" className="mt-3 space-y-1.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Webhook créé — copiez le secret maintenant, il ne sera plus jamais affiché :</p>
          <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{revealedSecret}</p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-surface-border">
        {webhooks.map((webhook) => (
          <li key={webhook.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 break-all font-mono text-sm">
                  {webhook.url}
                  {webhook.isActive ? (
                    <Badge tone="success">Actif</Badge>
                  ) : (
                    <Badge tone="neutral">Suspendu</Badge>
                  )}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {webhook.events.map((e) => EVENT_LABELS[e] ?? e).join(', ')}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => toggleActive(webhook)}>
                    {webhook.isActive ? 'Suspendre' : 'Réactiver'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(webhook)}>
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
        {webhooks.length === 0 && <p className="py-3 text-sm text-ink-muted">Aucun webhook configuré.</p>}
      </ul>

      {canManage && (
        <form onSubmit={createWebhook} className="mt-4 space-y-3">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemple.com/webhooks/magyapro"
            className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <label key={value} className={cx('flex items-center gap-1.5 text-sm')}>
                <input
                  type="checkbox"
                  checked={events.includes(value)}
                  onChange={() => toggleEvent(value)}
                  className="accent-ink"
                />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" loading={pending}>
            Créer le webhook
          </Button>
        </form>
      )}
    </Card>
  );
}
