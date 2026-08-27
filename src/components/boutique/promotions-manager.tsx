'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { Badge, Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type Promotion = {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minCartAmount: number;
  maxRedemptions: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export function PromotionsManager({
  initialPromotions,
  currency,
  canManage,
}: {
  initialPromotions: Promotion[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [promotions] = useState(initialPromotions);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [pending, setPending] = useState(false);

  async function remove(promotion: Promotion) {
    if (!window.confirm(`Supprimer le code promo « ${promotion.code} » ?`)) return;
    setPending(true);
    try {
      await api.delete(`/api/boutique/promotions/${promotion.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          + Nouveau code promo
        </Button>
      )}

      {(showForm || editing) && (
        <PromotionForm
          currency={currency}
          promotion={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {promotions.length === 0 ? (
        <EmptyState
          title="Aucun code promo"
          description="Créez un code que vos clients pourront présenter en caisse pour obtenir une réduction."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Réduction</th>
                <th className="px-4 py-3 font-medium">Utilisations</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => (
                <tr key={promo.id} className="border-b border-surface-border last:border-0">
                  <td data-label="Code" className="px-4 py-3 font-mono font-medium">
                    {promo.code}
                  </td>
                  <td data-label="Réduction" className="px-4 py-3 text-ink-muted">
                    {promo.type === 'PERCENT' ? `${promo.value} %` : formatMoney(promo.value, currency)}
                    {promo.minCartAmount > 0 && (
                      <span className="block text-xs text-ink-faint">
                        Panier min. {formatMoney(promo.minCartAmount, currency)}
                      </span>
                    )}
                  </td>
                  <td data-label="Utilisations" className="px-4 py-3 text-ink-muted">
                    {promo.usedCount}
                    {promo.maxRedemptions !== null && ` / ${promo.maxRedemptions}`}
                  </td>
                  <td data-label="Période" className="px-4 py-3 text-xs text-ink-muted">
                    {promo.startsAt && `Du ${new Date(promo.startsAt).toLocaleDateString('fr-FR')} `}
                    {promo.endsAt && `au ${new Date(promo.endsAt).toLocaleDateString('fr-FR')}`}
                    {!promo.startsAt && !promo.endsAt && '—'}
                  </td>
                  <td data-label="Statut" className="px-4 py-3">
                    <Badge tone={promo.isActive ? 'success' : 'neutral'}>
                      {promo.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(promo)}>
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => remove(promo)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function PromotionForm({
  currency,
  promotion,
  onDone,
  onCancel,
}: {
  currency: string;
  promotion: Promotion | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'PERCENT' | 'FIXED'>(promotion?.type ?? 'PERCENT');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    setFieldErrors({});

    const rawValue = String(formData.get('value') ?? '0');
    const value = type === 'PERCENT' ? Number(rawValue) : toMinor(rawValue, currency);
    const maxRedemptions = String(formData.get('maxRedemptions') ?? '').trim();
    const startsAt = String(formData.get('startsAt') ?? '').trim();
    const endsAt = String(formData.get('endsAt') ?? '').trim();

    const payload = {
      code: String(formData.get('code') ?? ''),
      type,
      value,
      minCartAmount: toMinor(String(formData.get('minCartAmount') ?? '0'), currency),
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isActive: formData.get('isActive') === 'on',
    };

    try {
      if (promotion) {
        await api.patch(`/api/boutique/promotions/${promotion.id}`, payload);
      } else {
        await api.post('/api/boutique/promotions', payload);
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Le code promo n'a pas pu être enregistré.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">{promotion ? 'Modifier le code promo' : 'Nouveau code promo'}</h2>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        <Field label="Code" htmlFor="code" required error={fieldErrors.code} hint="Ex. SOLDES20">
          <input
            id="code"
            name="code"
            required
            defaultValue={promotion?.code}
            className={inputClass}
            style={{ textTransform: 'uppercase' }}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de réduction" htmlFor="type">
            <select
              id="type"
              value={type}
              onChange={(event) => setType(event.target.value as 'PERCENT' | 'FIXED')}
              className={inputClass}
            >
              <option value="PERCENT">Pourcentage</option>
              <option value="FIXED">Montant fixe</option>
            </select>
          </Field>
          <Field
            label={type === 'PERCENT' ? 'Valeur (%)' : `Valeur (${currency})`}
            htmlFor="value"
            required
            error={fieldErrors.value}
          >
            <input
              id="value"
              name="value"
              type="number"
              min={0}
              max={type === 'PERCENT' ? 100 : undefined}
              step={type === 'PERCENT' ? 1 : 0.01}
              required
              defaultValue={promotion ? (type === 'PERCENT' ? promotion.value : toMajor(promotion.value, currency)) : undefined}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Panier minimum (${currency})`} htmlFor="minCartAmount">
            <input
              id="minCartAmount"
              name="minCartAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={promotion ? toMajor(promotion.minCartAmount, currency) : 0}
              className={inputClass}
            />
          </Field>
          <Field label="Nombre d'utilisations max (facultatif)" htmlFor="maxRedemptions">
            <input
              id="maxRedemptions"
              name="maxRedemptions"
              type="number"
              min={1}
              defaultValue={promotion?.maxRedemptions ?? undefined}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Début (facultatif)" htmlFor="startsAt">
            <input
              id="startsAt"
              name="startsAt"
              type="date"
              defaultValue={promotion?.startsAt?.slice(0, 10)}
              className={inputClass}
            />
          </Field>
          <Field label="Fin (facultatif)" htmlFor="endsAt" error={fieldErrors.endsAt}>
            <input
              id="endsAt"
              name="endsAt"
              type="date"
              defaultValue={promotion?.endsAt?.slice(0, 10)}
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={promotion?.isActive ?? true}
            className="h-4 w-4 accent-ink"
          />
          Actif
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
