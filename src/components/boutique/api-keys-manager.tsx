'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** Clés d'API pour l'accès en lecture seule à `/api/v1/*` — voir `api-auth.ts`. */
export function ApiKeysManager({ apiKeys, canManage }: { apiKeys: ApiKey[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return;

    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ key: string }>('/api/boutique/api-keys', { name });
      setRevealedKey(result.key);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La clé n'a pas pu être créée.");
    } finally {
      setPending(false);
    }
  }

  async function revoke(key: ApiKey) {
    if (!window.confirm(`Révoquer la clé « ${key.name} » ? Toute intégration qui l'utilise cessera de fonctionner.`)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/boutique/api-keys/${key.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La révocation a échoué.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Clés d&apos;API</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Pour un accès en lecture seule à votre catalogue et vos ventes depuis un service externe,
        avec l&apos;en-tête <span className="font-mono">Authorization: Bearer &lt;clé&gt;</span>.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {revealedKey && (
        <div role="status" className="mt-3 space-y-1.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Clé créée — copiez-la maintenant, elle ne sera plus jamais affichée :</p>
          <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{revealedKey}</p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-surface-border">
        {apiKeys.map((key) => (
          <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-sm">
                {key.keyPrefix}…
                {key.revokedAt ? (
                  <Badge tone="danger">Révoquée</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {key.name} · créée le{' '}
                {new Date(key.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {key.lastUsedAt &&
                  ` · dernière utilisation le ${new Date(key.lastUsedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
              </p>
            </div>
            {!key.revokedAt && canManage && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => revoke(key)}>
                Révoquer
              </Button>
            )}
          </li>
        ))}
        {apiKeys.length === 0 && <p className="py-3 text-sm text-ink-muted">Aucune clé créée.</p>}
      </ul>

      {canManage && (
        <form onSubmit={createKey} className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="key-name" className="sr-only">
            Nom de la clé
          </label>
          <input
            id="key-name"
            name="name"
            required
            placeholder="Ex. Intégration comptabilité"
            className={cx(inputClass, 'flex-1 min-w-52')}
          />
          <Button type="submit" loading={pending}>
            Créer une clé
          </Button>
        </form>
      )}
    </Card>
  );
}
