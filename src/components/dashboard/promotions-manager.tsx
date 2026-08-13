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
  minOrder: number;
  maxRedemptions: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

/** Convertit une date ISO en valeur d'`<input type="date">`. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function PromotionsManager({
  promotions,
  currency,
  canManage,
}: {
  promotions: Promotion[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openEditor(promotion: Promotion | 'new') {
    setEditing(promotion);
    setType(promotion === 'new' ? 'PERCENT' : promotion.type);
    setError(null);
    setFieldErrors({});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const formData = new FormData(event.currentTarget);
    const maxRaw = String(formData.get('maxRedemptions') ?? '').trim();
    const startsRaw = String(formData.get('startsAt') ?? '').trim();
    const endsRaw = String(formData.get('endsAt') ?? '').trim();
    const valueRaw = String(formData.get('value') ?? '0');

    const payload = {
      code: String(formData.get('code') ?? ''),
      type,
      // Un pourcentage est un entier brut ; un montant fixe est converti en
      // unité mineure comme tous les autres montants.
      value: type === 'PERCENT' ? Number(valueRaw) : toMinor(valueRaw, currency),
      minOrder: toMinor(String(formData.get('minOrder') ?? '0'), currency),
      maxRedemptions: maxRaw ? Number(maxRaw) : null,
      startsAt: startsRaw ? new Date(startsRaw).toISOString() : null,
      endsAt: endsRaw ? new Date(endsRaw).toISOString() : null,
      isActive: formData.get('isActive') === 'on',
    };

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      if (editing === 'new') {
        await api.post('/api/promotions', payload);
      } else {
        await api.patch(`/api/promotions/${editing.id}`, payload);
      }
      setEditing(null);
      router.refresh();
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

  async function remove(promotion: Promotion) {
    if (!window.confirm(`Supprimer le code « ${promotion.code} » ?`)) return;

    setPendingId(promotion.id);
    setError(null);
    try {
      await api.delete(`/api/promotions/${promotion.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le code n'a pas pu être supprimé.");
    } finally {
      setPendingId(null);
    }
  }

  if (editing) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-medium">
          {editing === 'new' ? 'Nouveau code promo' : `Modifier « ${editing.code} »`}
        </h2>

        <form onSubmit={save} className="mt-5 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Field
            label="Code"
            htmlFor="code"
            required
            hint="Ce que le client saisira. Majuscules, chiffres, tiret."
            error={fieldErrors.code}
          >
            <input
              id="code"
              name="code"
              required
              defaultValue={editing === 'new' ? '' : editing.code}
              className={inputClass}
              placeholder="BIENVENUE10"
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">Type de remise</legend>
            <div className="mt-2 flex gap-2">
              {(['PERCENT', 'FIXED'] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm ${
                    type === value ? 'border-ink bg-ink text-white' : 'border-surface-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                    className="sr-only"
                  />
                  {value === 'PERCENT' ? 'Pourcentage' : 'Montant fixe'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={type === 'PERCENT' ? 'Remise (%)' : `Remise (${currency})`}
              htmlFor="value"
              required
              error={fieldErrors.value}
            >
              <input
                id="value"
                name="value"
                type="number"
                min="1"
                max={type === 'PERCENT' ? 100 : undefined}
                step={type === 'PERCENT' ? 1 : 'any'}
                required
                defaultValue={
                  editing === 'new'
                    ? ''
                    : editing.type === 'PERCENT'
                      ? editing.value
                      : toMajor(editing.value, currency)
                }
                className={inputClass}
              />
            </Field>

            <Field
              label={`Montant minimum (${currency})`}
              htmlFor="minOrder"
              hint="0 = aucun minimum"
              error={fieldErrors.minOrder}
            >
              <input
                id="minOrder"
                name="minOrder"
                type="number"
                min="0"
                step="any"
                defaultValue={editing === 'new' ? 0 : toMajor(editing.minOrder, currency)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Début" htmlFor="startsAt" error={fieldErrors.startsAt}>
              <input
                id="startsAt"
                name="startsAt"
                type="date"
                defaultValue={editing === 'new' ? '' : toDateInput(editing.startsAt)}
                className={inputClass}
              />
            </Field>

            <Field label="Fin" htmlFor="endsAt" error={fieldErrors.endsAt}>
              <input
                id="endsAt"
                name="endsAt"
                type="date"
                defaultValue={editing === 'new' ? '' : toDateInput(editing.endsAt)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Utilisations max."
              htmlFor="maxRedemptions"
              hint="Vide = illimité"
              error={fieldErrors.maxRedemptions}
            >
              <input
                id="maxRedemptions"
                name="maxRedemptions"
                type="number"
                min="1"
                defaultValue={editing === 'new' ? '' : (editing.maxRedemptions ?? '')}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing === 'new' ? true : editing.isActive}
              className="h-4 w-4 accent-ink"
            />
            Code actif
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Codes promo</h2>
          {canManage && (
            <Button size="sm" onClick={() => openEditor('new')}>
              Nouveau code
            </Button>
          )}
        </div>

        {promotions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aucun code promo"
              description="Créez un code pour offrir une remise à vos clients, avec une durée et une limite d'utilisation."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => openEditor('new')}>
                    Créer un code
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-surface-border">
            {promotions.map((promotion) => {
              const expired =
                promotion.endsAt !== null && new Date(promotion.endsAt) < new Date();
              const exhausted =
                promotion.maxRedemptions !== null &&
                promotion.usedCount >= promotion.maxRedemptions;

              return (
                <li key={promotion.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{promotion.code}</span>
                      {!promotion.isActive && <Badge tone="neutral">Désactivé</Badge>}
                      {expired && <Badge tone="warning">Expiré</Badge>}
                      {exhausted && <Badge tone="warning">Épuisé</Badge>}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {promotion.type === 'PERCENT'
                        ? `−${promotion.value} %`
                        : `−${formatMoney(promotion.value, currency)}`}
                      {promotion.minOrder > 0 &&
                        ` · dès ${formatMoney(promotion.minOrder, currency)}`}
                      {' · '}
                      {promotion.usedCount} utilisation
                      {promotion.usedCount > 1 ? 's' : ''}
                      {promotion.maxRedemptions !== null &&
                        ` / ${promotion.maxRedemptions}`}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditor(promotion)}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingId === promotion.id}
                        onClick={() => remove(promotion)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
