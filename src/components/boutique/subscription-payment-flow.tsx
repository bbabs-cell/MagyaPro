'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api, uploadFile } from '@/lib/client/api';
import { Badge, Button, Card, cx } from '@/components/ui';

/**
 * Paiement manuel de l'abonnement Boutique — copie de
 * `src/components/dashboard/subscription-payment-flow.tsx` (Restaurant)
 * pointant vers les routes `/api/boutique/abonnement*`. Fichier distinct
 * plutôt que composant partagé paramétrable : les deux produits ne doivent
 * jamais partager un point d'accès réseau, seulement l'apparence.
 */

type Plan = {
  key: string;
  name: string;
  description: string | null;
  priceLabel: string;
  price: number;
  interval: 'MONTH' | 'YEAR';
  trialDays: number;
  features: string[];
};

type PendingPayment = {
  id: string;
  planName: string;
  amountLabel: string;
  provider: 'wave_manual' | 'orange_money_manual';
  receivingNumber: string;
  proofImageUrl: string | null;
};

const PROVIDER_LABELS: Record<'wave_manual' | 'orange_money_manual', string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

const COUNTRIES = [
  'Sénégal',
  "Côte d'Ivoire",
  'Mali',
  'Bénin',
  'Burkina Faso',
  'Guinée',
  'Togo',
  'Niger',
  'Autre',
];

export function StoreSubscriptionPaymentFlow({
  plans,
  currentPlanKey,
  canManage,
  availableProviders,
  pendingPayment,
}: {
  plans: Plan[];
  currentPlanKey: string | null;
  canManage: boolean;
  availableProviders: Array<'wave_manual' | 'orange_money_manual'>;
  pendingPayment: PendingPayment | null;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [payingPlanKey, setPayingPlanKey] = useState<string | null>(null);
  const [provider, setProvider] = useState<'wave_manual' | 'orange_money_manual' | null>(
    availableProviders[0] ?? null,
  );
  const [country, setCountry] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<PendingPayment | null>(pendingPayment);
  const inputRef = useRef<HTMLInputElement>(null);

  async function switchFreePlan(plan: Plan) {
    if (!window.confirm(`Passer au plan ${plan.name} ?`)) return;

    setSwitching(plan.key);
    setError(null);
    try {
      await api.post('/api/boutique/abonnement', { planKey: plan.key });
      setMessage(`Vous êtes maintenant sur le plan ${plan.name}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le plan n'a pas pu être changé.");
    } finally {
      setSwitching(null);
    }
  }

  async function requestPayment(plan: Plan) {
    if (!provider || !country) return;
    setCreating(true);
    setError(null);
    try {
      const result = await api.post<{
        paymentId: string;
        amountLabel: string;
        planName: string;
        receivingNumber: string;
      }>('/api/boutique/abonnement/paiement', { planKey: plan.key, provider, country });

      setActivePayment({
        id: result.paymentId,
        planName: result.planName,
        amountLabel: result.amountLabel,
        provider,
        receivingNumber: result.receivingNumber,
        proofImageUrl: null,
      });
      setPayingPlanKey(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La demande de paiement a échoué.');
    } finally {
      setCreating(false);
    }
  }

  async function handleProofFile(file: File) {
    if (!activePayment) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadFile<{ payment: { proofImageUrl: string | null } }>(
        `/api/boutique/abonnement/paiement/${activePayment.id}/preuve`,
        formData,
      );
      setActivePayment({ ...activePayment, proofImageUrl: result.payment.proofImageUrl });
      setMessage('Preuve envoyée. Votre paiement sera validé sous peu.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La preuve n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (activePayment) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Badge tone="warning">En attente de validation</Badge>
        </div>
        <p className="mt-3 text-sm">
          Plan <strong>{activePayment.planName}</strong> — {activePayment.amountLabel} via{' '}
          {PROVIDER_LABELS[activePayment.provider]}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Envoyez le montant au <strong>{activePayment.receivingNumber}</strong> (
          {PROVIDER_LABELS[activePayment.provider]}), puis déposez votre preuve ci-dessous si ce
          n&apos;est pas déjà fait. Un administrateur validera la réception sous peu.
        </p>

        {activePayment.proofImageUrl ? (
          <p className="mt-3 text-sm text-state-ok">Preuve déposée, en attente de validation.</p>
        ) : uploading ? (
          <p className="mt-4 text-sm text-ink-muted">Envoi de la preuve…</p>
        ) : (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              id="store-subscription-proof-upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleProofFile(file);
              }}
            />
            <label
              htmlFor="store-subscription-proof-upload"
              className="inline-flex h-11 cursor-pointer items-center rounded-xl bg-brand px-4 text-sm font-medium text-white"
            >
              Déposer ma preuve de paiement
            </label>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-state-bad">{error}</p>}
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="mb-4 rounded-xl bg-state-ok-soft px-4 py-3 text-sm text-state-ok">
          {message}
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium">Plans disponibles</h2>

      {plans.length === 0 && (
        <p className="text-sm text-ink-muted">
          Aucun plan n&apos;est proposé pour le moment. Revenez bientôt.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          const isFree = plan.price <= 0;
          const isPaying = payingPlanKey === plan.key;

          return (
            <Card
              key={plan.key}
              className={cx('p-5', isCurrent && 'border-brand ring-1 ring-brand')}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {isCurrent && <Badge tone="brand">Actuel</Badge>}
              </div>

              {plan.description && (
                <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
              )}

              <p className="mt-4">
                <span className="text-2xl font-semibold tracking-tight">{plan.priceLabel}</span>
                <span className="text-sm text-ink-muted">
                  {plan.interval === 'MONTH' ? ' / mois' : ' / an'}
                </span>
              </p>

              <ul className="mt-4 space-y-1.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {canManage && !isCurrent && isFree && (
                <Button
                  className="mt-5 w-full"
                  disabled={switching !== null}
                  onClick={() => switchFreePlan(plan)}
                >
                  {switching === plan.key ? 'Changement…' : `Choisir ${plan.name}`}
                </Button>
              )}

              {canManage && !isCurrent && !isFree && !isPaying && (
                <Button
                  variant="secondary"
                  className="mt-5 w-full"
                  disabled={availableProviders.length === 0}
                  onClick={() => setPayingPlanKey(plan.key)}
                >
                  {availableProviders.length === 0
                    ? 'Paiement indisponible'
                    : `Payer et choisir ${plan.name}`}
                </Button>
              )}

              {isPaying && (
                <div className="mt-5 space-y-3 rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Payer via
                  </p>
                  <div className="flex gap-2">
                    {availableProviders.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setProvider(id)}
                        className={cx(
                          'rounded-lg border px-3 py-1.5 text-sm',
                          provider === id
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-surface-border text-ink-muted',
                        )}
                      >
                        {PROVIDER_LABELS[id]}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label
                      htmlFor={`country-${plan.key}`}
                      className="block text-xs font-medium uppercase tracking-wide text-ink-faint"
                    >
                      Pays d&apos;où vous effectuez le transfert
                    </label>
                    <select
                      id={`country-${plan.key}`}
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="">Choisir un pays…</option>
                      {COUNTRIES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={creating || !provider || !country}
                      onClick={() => requestPayment(plan)}
                    >
                      {creating ? 'Création…' : 'Obtenir les instructions'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPayingPlanKey(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
