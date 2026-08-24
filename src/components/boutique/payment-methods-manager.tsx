'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

type PaymentMethod = { id: string; method: string; label: string; isEnabled: boolean };

/** Moyens de paiement de la caisse — voir `src/lib/boutique/payment-methods.ts`. */
export function PaymentMethodsManager({
  methods,
  canManage,
}: {
  methods: PaymentMethod[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(method: PaymentMethod) {
    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/boutique/moyens-paiement/${method.id}`, { isEnabled: !method.isEnabled });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La mise à jour a échoué.');
    } finally {
      setPending(false);
    }
  }

  async function remove(method: PaymentMethod) {
    if (!window.confirm(`Retirer « ${method.label} » ?`)) return;
    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/boutique/moyens-paiement/${method.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La suppression a échoué.');
    } finally {
      setPending(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get('label') ?? '').trim();
    const method = String(formData.get('method') ?? '').trim();
    if (!label || !method) return;

    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/moyens-paiement', { method, label });
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le moyen de paiement n'a pas pu être ajouté.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Moyens de paiement</h2>
      <p className="mt-1 text-sm text-ink-muted">Proposés à la caisse, dans cet ordre.</p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <ul className="mt-4 divide-y divide-surface-border">
        {methods.map((method) => (
          <li key={method.id} className="flex items-center justify-between gap-3 py-2.5">
            <p className="flex items-center gap-2 text-sm">
              {method.label}
              <span className="font-mono text-xs text-ink-faint">{method.method}</span>
              {method.isEnabled ? (
                <Badge tone="success">Actif</Badge>
              ) : (
                <Badge tone="neutral">Désactivé</Badge>
              )}
            </p>
            {canManage && (
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => toggle(method)}>
                  {method.isEnabled ? 'Désactiver' : 'Activer'}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(method)}>
                  Retirer
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
          <input
            name="label"
            required
            placeholder="Libellé (ex. Chèque)"
            className={cx(inputClass, 'flex-1 min-w-40')}
          />
          <input
            name="method"
            required
            placeholder="identifiant (ex. cheque)"
            className={cx(inputClass, 'flex-1 min-w-40 font-mono')}
          />
          <Button type="submit" loading={pending}>
            Ajouter
          </Button>
        </form>
      )}
    </Card>
  );
}
