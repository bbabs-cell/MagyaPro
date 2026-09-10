import type { SubscriptionStatus } from '@prisma/client';

import { formatMoney } from '@/lib/money';
import { daysUntil, deadlineLabel, RENEWAL_SOON_DAYS } from '@/lib/admin/subscriptions-list';
import { subscriptionStatusLabel, subscriptionStatusTone } from '@/lib/subscription-labels';
import { paymentMethodLabel } from '@/lib/boutique/labels';
import { AdminStateBadge } from '@/components/admin/state-badge';
import type { TenantPayment } from '@/lib/platform-revenue';

/**
 * Panneau d'abonnement d'une fiche client, commun aux deux produits.
 *
 * La fiche d'un restaurant n'affichait que le prix de son plan ; celle d'une
 * boutique, rien du tout. La question qu'on se pose en ouvrant une fiche —
 * « est-ce que ce client est à jour » — demandait donc de retourner sur la
 * liste des abonnements et d'y retrouver la ligne.
 *
 * Trois choses y répondent, dans cet ordre : le statut, l'échéance formulée en
 * clair, et ce que le client a réellement réglé.
 */
export function SubscriptionPanel({
  plan,
  status,
  currentPeriodEnd,
  payments,
  billingNote,
  now,
}: {
  plan: { name: string; price: number; currency: string; interval: 'MONTH' | 'YEAR' };
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  payments: TenantPayment[];
  /** Précision de facturation — boutique supplémentaire, plan d'un autre produit. */
  billingNote?: string | null;
  /** Date figée côté serveur : le retard ne doit pas dépendre du navigateur. */
  now: Date;
}) {
  const days = daysUntil(currentPeriodEnd, now);
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="rounded-2xl border border-white/10 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{plan.name}</p>
          <p className="mt-0.5 text-white/50">
            {formatMoney(plan.price, plan.currency)} / {plan.interval === 'MONTH' ? 'mois' : 'an'}
          </p>
        </div>
        <AdminStateBadge label={subscriptionStatusLabel(status)} tone={subscriptionStatusTone(status)} />
      </div>

      <p
        className={`mt-3 border-t border-white/10 pt-3 ${
          days < 0 ? 'text-red-300' : days <= RENEWAL_SOON_DAYS ? 'text-amber-200' : 'text-white/60'
        }`}
      >
        Période jusqu&apos;au {currentPeriodEnd.toLocaleDateString('fr-FR')} — {deadlineLabel(days)}
      </p>

      {billingNote && (
        <p className="mt-2 rounded-md bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
          {billingNote}
        </p>
      )}

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs uppercase tracking-wide text-white/40">
          Règlements validés
          {payments.length > 0 && (
            <span className="normal-case tracking-normal text-white/60">
              {formatMoney(total, payments[0]!.currency)} sur {payments.length} règlement
              {payments.length > 1 ? 's' : ''}
            </span>
          )}
        </p>

        {payments.length === 0 ? (
          // Un client peut être actif sans avoir jamais réglé : essai en cours,
          // ou abonnement ouvert à la main depuis cette page. Le dire est plus
          // utile qu'une liste vide.
          <p className="mt-2 text-white/50">
            Aucun règlement validé — essai en cours, ou abonnement ouvert manuellement.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="text-white/70">
                  {payment.paidAt.toLocaleDateString('fr-FR')}
                  <span className="ml-2 text-xs text-white/40">
                    {payment.planName} · {paymentMethodLabel(payment.provider)}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatMoney(payment.amount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
