'use client';

import { useState, type FormEvent } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { AlertMessage, Badge, Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type Tier = {
  id: string;
  name: string;
  thresholdSpent: number;
  rewardType: 'PERCENT' | 'FIXED';
  rewardValue: number;
  isActive: boolean;
};

type Reward = {
  id: string;
  customerName: string;
  tierName: string;
  code: string;
  used: boolean;
  grantedAt: string;
};

export function LoyaltyManager({
  tiers,
  recentRewards,
  currency,
  canManage,
}: {
  tiers: Tier[];
  recentRewards: Reward[];
  currency: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<Tier | 'new' | null>(null);
  const [rewardType, setRewardType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const mutation = useServerMutation();
  const fieldErrors = mutation.fieldErrors;

  function openEditor(tier: Tier | 'new') {
    setEditing(tier);
    setRewardType(tier === 'new' ? 'PERCENT' : tier.rewardType);
    mutation.clearError();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const formData = new FormData(event.currentTarget);
    const rewardValueRaw = String(formData.get('rewardValue') ?? '0');

    const payload = {
      name: String(formData.get('name') ?? ''),
      thresholdSpent: toMinor(String(formData.get('thresholdSpent') ?? '0'), currency),
      rewardType,
      rewardValue:
        rewardType === 'PERCENT' ? Number(rewardValueRaw) : toMinor(rewardValueRaw, currency),
      isActive: formData.get('isActive') === 'on',
    };

    const isNew = editing === 'new';
    mutation.run(
      () =>
        isNew
          ? api.post('/api/fidelite', payload)
          : api.patch(`/api/fidelite/${editing.id}`, payload),
      {
        key: 'enregistrement',
        onSuccess: () => setEditing(null),
        successMessage: isNew ? 'Palier créé.' : 'Palier modifié.',
        failureMessage: "Le palier n'a pas pu être enregistré.",
      },
    );
  }

  function remove(tier: Tier) {
    if (!window.confirm(`Supprimer le palier « ${tier.name} » ?`)) return;
    mutation.run(() => api.delete(`/api/fidelite/${tier.id}`), {
      key: tier.id,
      successMessage: 'Palier supprimé.',
      failureMessage: "Le palier n'a pas pu être supprimé.",
    });
  }

  if (editing) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-medium">
          {editing === 'new' ? 'Nouveau palier' : `Modifier « ${editing.name} »`}
        </h2>

        <form onSubmit={save} className="mt-5 space-y-4" noValidate>
          <AlertMessage message={mutation.error} />

          <Field label="Nom du palier" htmlFor="name" required error={fieldErrors.name}>
            <input
              id="name"
              name="name"
              required
              defaultValue={editing === 'new' ? '' : editing.name}
              className={inputClass}
              placeholder="Habitué"
            />
          </Field>

          <Field
            label={`Dépenses cumulées requises (${currency})`}
            htmlFor="thresholdSpent"
            required
            error={fieldErrors.thresholdSpent}
          >
            <input
              id="thresholdSpent"
              name="thresholdSpent"
              type="number"
              min="1"
              step="any"
              required
              defaultValue={editing === 'new' ? '' : toMajor(editing.thresholdSpent, currency)}
              className={inputClass}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">Récompense</legend>
            <div className="mt-2 flex gap-2">
              {(['PERCENT', 'FIXED'] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm ${
                    rewardType === value ? 'border-brand bg-brand text-white' : 'border-surface-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="rewardType"
                    value={value}
                    checked={rewardType === value}
                    onChange={() => setRewardType(value)}
                    className="sr-only"
                  />
                  {value === 'PERCENT' ? 'Pourcentage' : 'Montant fixe'}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label={rewardType === 'PERCENT' ? 'Remise (%)' : `Remise (${currency})`}
            htmlFor="rewardValue"
            required
            error={fieldErrors.rewardValue}
          >
            <input
              id="rewardValue"
              name="rewardValue"
              type="number"
              min="1"
              max={rewardType === 'PERCENT' ? 100 : undefined}
              step={rewardType === 'PERCENT' ? 1 : 'any'}
              required
              defaultValue={
                editing === 'new'
                  ? ''
                  : editing.rewardType === 'PERCENT'
                    ? editing.rewardValue
                    : toMajor(editing.rewardValue, currency)
              }
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing === 'new' ? true : editing.isActive}
              className="h-4 w-4 accent-ink"
            />
            Palier actif
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={mutation.isPending('enregistrement')}>
              Enregistrer
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
      <AlertMessage message={mutation.error} className="mb-4" />

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Paliers</h2>
          {canManage && (
            <Button size="sm" onClick={() => openEditor('new')}>
              Nouveau palier
            </Button>
          )}
        </div>

        {tiers.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aucun palier"
              description="Créez un palier pour récompenser automatiquement vos clients les plus fidèles."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => openEditor('new')}>
                    Créer un palier
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-surface-border">
            {tiers.map((tier) => (
              <li key={tier.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tier.name}</span>
                    {!tier.isActive && <Badge tone="neutral">Désactivé</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    dès {formatMoney(tier.thresholdSpent, currency)} cumulés ·{' '}
                    {tier.rewardType === 'PERCENT'
                      ? `−${tier.rewardValue} %`
                      : `−${formatMoney(tier.rewardValue, currency)}`}
                  </p>
                </div>

                {canManage && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => openEditor(tier)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={mutation.isPending(tier.id)}
                      disabled={mutation.pending}
                      onClick={() => remove(tier)}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-4 sm:p-5">
        <h2 className="text-sm font-medium">Récompenses récentes</h2>
        {recentRewards.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Rien pour le moment — les récompenses accordées automatiquement
            apparaîtront ici.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-border">
            {recentRewards.map((reward) => (
              <li key={reward.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{reward.customerName}</span> a atteint «{' '}
                  {reward.tierName} »
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{reward.code}</span>
                  <Badge tone={reward.used ? 'neutral' : 'success'}>
                    {reward.used ? 'Utilisé' : 'Disponible'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
