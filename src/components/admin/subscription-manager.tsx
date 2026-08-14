'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

type Plan = { id: string; name: string };

const STATUSES = [
  { value: 'TRIALING', label: 'En essai' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'PAST_DUE', label: 'En retard' },
  { value: 'CANCELLED', label: 'Résilié' },
  { value: 'EXPIRED', label: 'Expiré' },
] as const;

/** Convertit une date en valeur `datetime-local`, dans le fuseau du navigateur. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Gestion fine de l'abonnement d'un restaurant, depuis l'administration.
 *
 * Trois leviers indépendants : changer de plan, prolonger une période (essai
 * ou facturation) de quelques jours ou jusqu'à une date précise, forcer un
 * statut. Chaque envoi ne modifie que les champs touchés.
 */
export function SubscriptionManager({
  restaurantId,
  plans,
  subscription,
}: {
  restaurantId: string;
  plans: Plan[];
  subscription: {
    planId: string;
    status: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
  };
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(subscription.planId);
  const [status, setStatus] = useState(subscription.status);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(
    toLocalInput(subscription.currentPeriodEnd),
  );
  const [trialEndsAt, setTrialEndsAt] = useState(
    subscription.trialEndsAt ? toLocalInput(subscription.trialEndsAt) : '',
  );
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed =
    planId !== subscription.planId ||
    status !== subscription.status ||
    toLocalInput(subscription.currentPeriodEnd) !== currentPeriodEnd ||
    (subscription.trialEndsAt ? toLocalInput(subscription.trialEndsAt) : '') !== trialEndsAt;

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/api/admin/restaurants/${restaurantId}/subscription`, {
        planId: planId !== subscription.planId ? planId : undefined,
        status: status !== subscription.status ? status : undefined,
        currentPeriodEnd:
          toLocalInput(subscription.currentPeriodEnd) !== currentPeriodEnd
            ? new Date(currentPeriodEnd).toISOString()
            : undefined,
        trialEndsAt:
          (subscription.trialEndsAt ? toLocalInput(subscription.trialEndsAt) : '') !== trialEndsAt
            ? trialEndsAt
              ? new Date(trialEndsAt).toISOString()
              : null
            : undefined,
        reason: reason || undefined,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'abonnement n'a pas pu être modifié.");
    } finally {
      setPending(false);
    }
  }

  function extendDays(days: number) {
    const base = new Date(currentPeriodEnd);
    base.setDate(base.getDate() + days);
    setCurrentPeriodEnd(toLocalInput(base.toISOString()));
  }

  const inputStyle =
    'w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white';
  const labelStyle = 'block text-sm';

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {saved && !changed && (
        <p role="status" className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          Abonnement mis à jour.
        </p>
      )}

      <label className={labelStyle}>
        Plan
        <select
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
          className={`mt-1 ${inputStyle}`}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelStyle}>
        Statut
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`mt-1 ${inputStyle}`}
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <label className={labelStyle} htmlFor="currentPeriodEnd">
          Fin de période de facturation
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="currentPeriodEnd"
            type="datetime-local"
            value={currentPeriodEnd}
            onChange={(event) => setCurrentPeriodEnd(event.target.value)}
            className={inputStyle}
          />
          <button
            type="button"
            onClick={() => extendDays(7)}
            className="shrink-0 rounded-xl border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
          >
            +7 jours
          </button>
          <button
            type="button"
            onClick={() => extendDays(30)}
            className="shrink-0 rounded-xl border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
          >
            +30 jours
          </button>
        </div>
      </div>

      <label className={labelStyle} htmlFor="trialEndsAt">
        Fin d&apos;essai
        <span className="mt-1 block text-xs text-white/50">
          Videz le champ pour retirer l&apos;essai en cours.
        </span>
        <input
          id="trialEndsAt"
          type="datetime-local"
          value={trialEndsAt}
          onChange={(event) => setTrialEndsAt(event.target.value)}
          className={`mt-1 ${inputStyle}`}
        />
      </label>

      <label className={labelStyle} htmlFor="reason">
        Motif (facultatif, consigné au journal)
        <input
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Geste commercial, correction d'une erreur de facturation…"
          className={`mt-1 ${inputStyle}`}
        />
      </label>

      <button
        type="button"
        disabled={pending || !changed}
        onClick={save}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-white/90 disabled:opacity-50"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer les changements'}
      </button>
    </div>
  );
}
