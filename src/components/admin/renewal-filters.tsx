import Link from 'next/link';
import type { SubscriptionStatus } from '@prisma/client';

import { RENEWAL_SOON_DAYS, type DeadlineFilter } from '@/lib/admin/subscriptions-list';
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_LABELS } from '@/lib/subscription-labels';

/**
 * Barre de filtres des deux écrans d'abonnements.
 *
 * Elle réunit trois choses qui répondent à la même question — « qui dois-je
 * regarder aujourd'hui » : la recherche par nom, le filtre de statut, et les
 * deux raccourcis de relance.
 *
 * Les compteurs de relance portent sur toute la plateforme et non sur la
 * sélection courante : ce sont des alertes, elles ne doivent pas changer de
 * valeur parce qu'on vient de filtrer sur autre chose.
 *
 * Tout passe en GET, donc dans l'URL : les filtres sont partageables,
 * rechargeables, et la page fonctionne sans JavaScript.
 */

const INPUT_CLASS =
  'min-w-52 flex-1 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40';

export function RenewalFilters({
  basePath,
  status,
  search,
  deadline,
  counts,
  tenantLabel,
}: {
  basePath: string;
  status: SubscriptionStatus | 'ALL';
  search?: string;
  deadline?: DeadlineFilter;
  counts: { overdue: number; soon: number };
  /** « un restaurant » ou « une boutique » — pour l'invite de recherche. */
  tenantLabel: string;
}) {
  const chipClass = (active: boolean, tone: 'danger' | 'warning') => {
    if (active) return tone === 'danger' ? 'bg-red-500/30 text-red-100' : 'bg-amber-500/30 text-amber-100';
    return tone === 'danger'
      ? 'bg-red-500/15 text-red-200 hover:bg-red-500/25'
      : 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25';
  };

  return (
    <>
      {(counts.overdue > 0 || counts.soon > 0) && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {counts.overdue > 0 && (
            <Link
              href={deadline === 'overdue' ? basePath : `${basePath}?echeance=overdue`}
              aria-current={deadline === 'overdue' ? 'true' : undefined}
              className={`rounded-lg px-3 py-1.5 ${chipClass(deadline === 'overdue', 'danger')}`}
            >
              {counts.overdue} échéance{counts.overdue > 1 ? 's' : ''} dépassée
              {counts.overdue > 1 ? 's' : ''}
            </Link>
          )}
          {counts.soon > 0 && (
            <Link
              href={deadline === 'soon' ? basePath : `${basePath}?echeance=soon`}
              aria-current={deadline === 'soon' ? 'true' : undefined}
              className={`rounded-lg px-3 py-1.5 ${chipClass(deadline === 'soon', 'warning')}`}
            >
              {counts.soon} à relancer sous {RENEWAL_SOON_DAYS} jours
            </Link>
          )}
        </div>
      )}

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher {tenantLabel}
        </label>
        <input id="q" name="q" defaultValue={search ?? ''} placeholder="Nom, adresse ou email" className={INPUT_CLASS} />
        <label htmlFor="statut" className="sr-only">
          Filtrer par statut
        </label>
        <select
          id="statut"
          name="statut"
          defaultValue={status === 'ALL' ? '' : status}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
        >
          <option value="" className="text-ink">
            Tous les statuts
          </option>
          {SUBSCRIPTION_STATUSES.map((key) => (
            <option key={key} value={key} className="text-ink">
              {SUBSCRIPTION_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        {/* Le filtre d'échéance survit à une recherche : sans ce champ caché,
            chercher un nom depuis « à relancer » ramènerait toute la liste. */}
        {deadline && <input type="hidden" name="echeance" value={deadline} />}
        <button
          type="submit"
          className="h-11 rounded-xl bg-white px-4 text-sm font-medium text-ink hover:bg-white/90"
        >
          Filtrer
        </button>
        {(search || deadline || status !== 'ALL') && (
          <Link
            href={basePath}
            className="flex h-11 items-center rounded-xl px-3 text-sm text-white/60 hover:text-white"
          >
            Tout afficher
          </Link>
        )}
      </form>
    </>
  );
}
