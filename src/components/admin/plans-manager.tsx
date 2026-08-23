'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import type { PlanLimits } from '@/lib/entitlements';

type Plan = {
  id: string;
  key: string;
  product: 'RESTAURANT' | 'STORE';
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  trialDays: number;
  features: string[];
  limits: PlanLimits;
  isActive: boolean;
  position: number;
  subscriptionsCount: number;
};

const RESTAURANT_LIMIT_FIELDS: Array<{ key: keyof PlanLimits; label: string }> = [
  { key: 'maxProducts', label: 'Produits' },
  { key: 'maxCategories', label: 'Catégories' },
  { key: 'maxUsers', label: 'Utilisateurs' },
  { key: 'maxOrdersPerMonth', label: 'Commandes / mois' },
];

// Boutique n'a pour l'instant que ces deux limites réellement appliquées
// (voir src/lib/boutique/entitlements.ts) — inutile de proposer un champ
// sans effet, qui donnerait l'illusion d'un réglage qui ne fait rien.
const STORE_LIMIT_FIELDS: Array<{ key: keyof PlanLimits; label: string }> = [
  { key: 'maxProducts', label: 'Produits' },
  { key: 'maxUsers', label: 'Utilisateurs' },
];

const inputStyle =
  'w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40';
const buttonStyle = 'rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50';

export function PlansManager({
  plans,
  restaurantFeatures,
  storeFeatures,
}: {
  plans: Plan[];
  restaurantFeatures: Array<{ value: string; label: string }>;
  storeFeatures: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [product, setProduct] = useState<'RESTAURANT' | 'STORE'>('RESTAURANT');
  const [features, setFeatures] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const availableFeatures = product === 'STORE' ? storeFeatures : restaurantFeatures;
  const limitFields = product === 'STORE' ? STORE_LIMIT_FIELDS : RESTAURANT_LIMIT_FIELDS;

  function open(plan: Plan | 'new') {
    setEditing(plan);
    setProduct(plan === 'new' ? 'RESTAURANT' : plan.product);
    setFeatures(plan === 'new' ? [] : plan.features);
    setError(null);
    setFieldErrors({});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const formData = new FormData(event.currentTarget);
    const currency = String(formData.get('currency') ?? 'XOF');

    // Une limite laissée vide n'est pas envoyée : elle reste indéfinie, donc
    // non appliquée. « -1 » exprime explicitement « illimité ».
    const limits: Record<string, number> = {};
    for (const field of limitFields) {
      const raw = String(formData.get(field.key) ?? '').trim();
      if (raw !== '') limits[field.key] = Number(raw);
    }

    const payload = {
      key: String(formData.get('key') ?? ''),
      product,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      price: toMinor(String(formData.get('price') ?? '0'), currency),
      currency,
      interval: String(formData.get('interval') ?? 'MONTH'),
      trialDays: Number(formData.get('trialDays') ?? 0),
      features,
      limits,
      isActive: formData.get('isActive') === 'on',
      position: Number(formData.get('position') ?? 0),
    };

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      if (editing === 'new') {
        await api.post('/api/admin/plans', payload);
      } else {
        await api.patch(`/api/admin/plans/${editing.id}`, payload);
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Le plan n'a pas pu être enregistré.");
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(plan: Plan) {
    if (!window.confirm(`Supprimer le plan « ${plan.name} » ?`)) return;

    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/admin/plans/${plan.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    const plan = editing === 'new' ? null : editing;

    return (
      <div className="rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg font-medium">
          {plan ? `Modifier « ${plan.name} »` : 'Nouveau plan'}
        </h2>

        <form onSubmit={save} className="mt-5 space-y-4" noValidate>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <label className="block text-sm">
            Produit
            <select
              value={product}
              onChange={(event) => {
                const next = event.target.value as 'RESTAURANT' | 'STORE';
                setProduct(next);
                // Les clés de fonctionnalités ne sont pas les mêmes d'un
                // produit à l'autre : une sélection faite pour l'un n'a pas
                // de sens gardée en changeant vers l'autre.
                setFeatures([]);
              }}
              className={`${inputStyle} mt-1`}
            >
              <option value="RESTAURANT" className="text-ink">Restaurant</option>
              <option value="STORE" className="text-ink">Boutique</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Clé technique
              <input
                name="key"
                required
                defaultValue={plan?.key ?? ''}
                placeholder="pro"
                className={`${inputStyle} mt-1`}
              />
              {fieldErrors.key && (
                <span className="mt-1 block text-xs text-red-300">{fieldErrors.key}</span>
              )}
            </label>

            <label className="block text-sm">
              Nom affiché
              <input
                name="name"
                required
                defaultValue={plan?.name ?? ''}
                className={`${inputStyle} mt-1`}
              />
            </label>
          </div>

          <label className="block text-sm">
            Description
            <input
              name="description"
              defaultValue={plan?.description ?? ''}
              className={`${inputStyle} mt-1`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block text-sm">
              Prix
              <input
                name="price"
                type="number"
                min="0"
                step="any"
                required
                defaultValue={plan ? toMajor(plan.price, plan.currency) : ''}
                className={`${inputStyle} mt-1`}
              />
            </label>

            <label className="block text-sm">
              Devise
              <input
                name="currency"
                required
                maxLength={3}
                defaultValue={plan?.currency ?? 'XOF'}
                className={`${inputStyle} mt-1`}
              />
            </label>

            <label className="block text-sm">
              Périodicité
              <select
                name="interval"
                defaultValue={plan?.interval ?? 'MONTH'}
                className={`${inputStyle} mt-1`}
              >
                <option value="MONTH" className="text-ink">Mensuelle</option>
                <option value="YEAR" className="text-ink">Annuelle</option>
              </select>
            </label>

            <label className="block text-sm">
              Jours d&apos;essai
              <input
                name="trialDays"
                type="number"
                min="0"
                max="365"
                defaultValue={plan?.trialDays ?? 14}
                className={`${inputStyle} mt-1`}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Limites</legend>
            <p className="mt-1 text-xs text-white/50">
              Vide = aucune limite appliquée. −1 = illimité affiché explicitement.
            </p>
            <div className="mt-2 grid gap-4 sm:grid-cols-4">
              {limitFields.map((field) => (
                <label key={field.key} className="block text-sm">
                  {field.label}
                  <input
                    name={field.key}
                    type="number"
                    min="-1"
                    defaultValue={plan?.limits[field.key] ?? ''}
                    className={`${inputStyle} mt-1`}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Fonctionnalités incluses</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {availableFeatures.map((feature) => (
                <label key={feature.value} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={features.includes(feature.value)}
                    onChange={(event) =>
                      setFeatures((current) =>
                        event.target.checked
                          ? [...current, feature.value]
                          : current.filter((value) => value !== feature.value),
                      )
                    }
                    className="h-4 w-4 accent-white"
                  />
                  {feature.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={plan?.isActive ?? true}
                className="h-4 w-4 accent-white"
              />
              Plan proposé à la vente
            </label>

            <label className="text-sm">
              Ordre d&apos;affichage
              <input
                name="position"
                type="number"
                min="0"
                defaultValue={plan?.position ?? plans.length}
                className={`${inputStyle} mt-1 w-24`}
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={pending}
              className={`${buttonStyle} bg-white text-ink hover:bg-white/90`}
            >
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={`${buttonStyle} text-white/60`}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => open('new')}
          className={`${buttonStyle} bg-white text-ink hover:bg-white/90`}
        >
          Nouveau plan
        </button>
      </div>

      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {plan.name}
                <span className="font-mono text-xs text-white/40">{plan.key}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {plan.product === 'STORE' ? 'Boutique' : 'Restaurant'}
                </span>
                {!plan.isActive && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                    Inactif
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-white/60">
                {formatMoney(plan.price, plan.currency)} /{' '}
                {plan.interval === 'MONTH' ? 'mois' : 'an'} · {plan.trialDays} j
                d&apos;essai · {plan.subscriptionsCount} abonné
                {plan.subscriptionsCount > 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => open(plan)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(plan)}
                className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-red-300 disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
