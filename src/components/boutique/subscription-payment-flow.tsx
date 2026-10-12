'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api, uploadFile } from '@/lib/client/api';
import { Badge, Button, Card, cx } from '@/components/ui';
import { paymentReference } from '@/lib/boutique/subscription-reference';

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
  /** Tarif affiché du plan. */
  priceLabel: string;
  /**
   * Montant réellement dû par CETTE boutique. Identique au tarif du plan pour
   * la première boutique d'un compte, majoré pour les suivantes. Calculé côté
   * serveur : le prix ne se recalcule jamais dans le navigateur.
   */
  amountLabel: string;
  price: number;
  interval: 'MONTH' | 'YEAR';
  trialDays: number;
  /** Limites du plan, déjà rédigées côté serveur (« Jusqu'à 200 produits »). */
  limits: string[];
  features: string[];
};

/**
 * Position de la boutique dans la facturation de son compte.
 *
 * `lockedPlanKey` est le plan imposé par la boutique principale : toutes les
 * boutiques d'un compte suivent le même plan, sans quoi « un pourcentage de
 * quel tarif ? » n'aurait pas de réponse.
 */
type Billing = {
  isAdditional: boolean;
  percent: number | null;
  lockedPlanKey: string | null;
};

type PendingPayment = {
  id: string;
  planName: string;
  amountLabel: string;
  provider: 'wave_manual' | 'orange_money_manual';
  receivingNumber: string;
  proofImageUrl: string | null;
  proofSubmittedAt?: string | null;
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
  billing,
}: {
  plans: Plan[];
  currentPlanKey: string | null;
  canManage: boolean;
  availableProviders: Array<'wave_manual' | 'orange_money_manual'>;
  pendingPayment: PendingPayment | null;
  billing: Billing;
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
  const [cancelling, setCancelling] = useState(false);
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
        proofSubmittedAt: null,
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
      setActivePayment({
        ...activePayment,
        proofImageUrl: result.payment.proofImageUrl,
        proofSubmittedAt: new Date().toISOString(),
      });
      setMessage('Preuve envoyée. Votre paiement sera validé sous peu.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La preuve n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function cancelRequest() {
    if (!activePayment) return;
    if (!window.confirm('Annuler cette demande de paiement ? Vous pourrez en faire une nouvelle.')) return;
    setCancelling(true);
    setError(null);
    try {
      await api.delete(`/api/boutique/abonnement/paiement/${activePayment.id}`);
      setActivePayment(null);
      setMessage('Demande annulée.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La demande n'a pas pu être annulée.");
    } finally {
      setCancelling(false);
    }
  }

  if (activePayment) {
    const reference = paymentReference(activePayment.id);
    const providerLabel = PROVIDER_LABELS[activePayment.provider];
    const amountDigits = activePayment.amountLabel.replace(/[^\d]/g, '');
    const proofSent = Boolean(activePayment.proofImageUrl);

    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={proofSent ? 'info' : 'warning'}>
            {proofSent ? 'Preuve reçue — vérification en cours' : 'Paiement à effectuer'}
          </Badge>
          <span className="text-xs text-ink-muted">
            Plan {activePayment.planName} · {providerLabel}
          </span>
        </div>

        {/* Trois gestes, dans l'ordre où on les fait téléphone en main. */}
        <ol className="mt-4 space-y-4">
          <PaymentStep index={1} done={proofSent} title={`Envoyez ${activePayment.amountLabel} par ${providerLabel}`}>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <CopyField label="Numéro" value={activePayment.receivingNumber} />
              <CopyField label="Montant exact" value={amountDigits} display={activePayment.amountLabel} />
            </div>
          </PaymentStep>
          <PaymentStep index={2} done={proofSent} title="Indiquez la référence dans le motif de l'envoi">
            <div className="mt-2 max-w-xs">
              <CopyField label="Référence" value={reference} />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Elle nous permet de retrouver votre envoi tout de suite, et de valider plus vite.
            </p>
          </PaymentStep>
          <PaymentStep
            index={3}
            done={proofSent}
            title={proofSent ? 'Capture reçue' : "Déposez la capture d'écran de l'envoi"}
          >
            {proofSent ? (
              <p className="mt-1 text-sm text-ink-muted">
                {activePayment.proofSubmittedAt
                  ? `Déposée le ${new Date(activePayment.proofSubmittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}. `
                  : ''}
                Validation en général sous 24 h : vous recevez une notification dès que c&apos;est fait.
              </p>
            ) : null}
            {uploading ? (
              <p className="mt-2 text-sm text-ink-muted">Envoi de la capture…</p>
            ) : (
              <div className="mt-2">
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
                  className={cx(
                    'inline-flex h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-medium',
                    proofSent
                      ? 'border border-surface-border bg-surface text-ink hover:bg-surface-sunken'
                      : 'bg-brand-strong text-brand-ink',
                  )}
                >
                  {proofSent ? 'Remplacer la capture' : 'Déposer la capture'}
                </label>
              </div>
            )}
          </PaymentStep>
        </ol>

        {message && <p role="status" className="mt-4 text-sm text-state-ok">{message}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-state-bad">{error}</p>}

        {!proofSent && canManage && (
          <button
            type="button"
            onClick={cancelRequest}
            disabled={cancelling}
            className="mt-5 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
          >
            {cancelling ? 'Annulation…' : 'Annuler cette demande (mauvais plan ou moyen de paiement)'}
          </button>
        )}
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

      {billing.isAdditional && billing.percent !== null && (
        <div className="mb-4 rounded-xl border border-surface-border bg-surface-sunken px-4 py-3 text-sm text-ink">
          <p className="font-medium text-ink">Boutique supplémentaire</p>
          <p className="mt-1 text-ink-muted">
            Ce n&apos;est pas la première boutique de votre compte : elle est facturée{' '}
            {billing.percent} % du tarif du plan. Les montants ci-dessous sont ceux que vous
            paierez réellement pour elle, en plus de vos autres boutiques.
          </p>
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium text-ink">Plans disponibles</h2>

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
          // Plan imposé par la boutique principale du compte. La règle est
          // aussi appliquée côté serveur : ce verrou ne fait qu'éviter un
          // aller-retour perdu.
          const isLockedOut = billing.lockedPlanKey !== null && plan.key !== billing.lockedPlanKey;

          return (
            <Card
              key={plan.key}
              className={cx('p-5', isCurrent && 'border-brand ring-1 ring-brand')}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-ink">{plan.name}</h3>
                {isCurrent && <Badge tone="brand">Actuel</Badge>}
              </div>

              {plan.description && (
                <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
              )}

              <p className="mt-4">
                <span className="text-2xl font-semibold tracking-tight text-ink">{plan.amountLabel}</span>
                <span className="text-sm text-ink-muted">
                  {plan.interval === 'MONTH' ? ' / mois' : ' / an'}
                </span>
              </p>
              {billing.isAdditional && !isFree && (
                <p className="mt-1 text-xs text-ink-faint">
                  {billing.percent} % du tarif {plan.name} ({plan.priceLabel})
                </p>
              )}

              <ul className="mt-4 space-y-1.5 text-sm text-ink">
                {[...plan.limits, ...plan.features].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand-text">✓</span>
                    {line}
                  </li>
                ))}
              </ul>

              {isLockedOut && (
                <p className="mt-5 text-xs text-ink-faint">
                  Vos boutiques suivent toutes le même plan. Changez-le depuis votre boutique
                  principale.
                </p>
              )}

              {canManage && !isLockedOut && !isCurrent && isFree && (
                <Button
                  className="mt-5 w-full"
                  disabled={switching !== null}
                  onClick={() => switchFreePlan(plan)}
                >
                  {switching === plan.key ? 'Changement…' : `Choisir ${plan.name}`}
                </Button>
              )}

              {canManage && !isLockedOut && !isFree && !isPaying && (
                /**
                 * Même règle que côté Restaurant : le plan courant n'avait
                 * aucun bouton, si bien qu'un abonnement ne pouvait pas être
                 * reconduit avant son échéance. Seul le libellé distingue
                 * reconduire son plan de changer de plan.
                 */
                <Button
                  variant="secondary"
                  className="mt-5 w-full"
                  disabled={availableProviders.length === 0}
                  onClick={() => setPayingPlanKey(plan.key)}
                >
                  {availableProviders.length === 0
                    ? 'Paiement indisponible'
                    : isCurrent
                      ? 'Reconduire mon abonnement'
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
                            ? 'border-brand bg-brand-soft text-brand-text'
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
                      className="mt-1.5 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink"
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

function PaymentStep({
  index,
  title,
  done,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={cx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          done ? 'bg-state-ok-soft text-state-ok' : 'bg-brand-soft text-brand-text',
        )}
      >
        {done ? '✓' : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Valeur à recopier dans l'application de paiement, avec son bouton
 * « Copier » : un chiffre mal recopié, c'est un envoi au mauvais numéro.
 */
function CopyField({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers indisponible (navigateur ancien) : la valeur reste lisible.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-sunken px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="truncate font-mono text-base font-semibold text-ink">{display ?? value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface"
        aria-label={`Copier ${label.toLowerCase()}`}
      >
        {copied ? 'Copié ✓' : 'Copier'}
      </button>
    </div>
  );
}
