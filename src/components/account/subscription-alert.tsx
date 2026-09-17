'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Bandeau de fin d'abonnement, affiché sur **toutes** les pages du tableau de
 * bord — Restaurant comme Boutique.
 *
 * L'échéance n'était visible que sur la page Abonnement, c'est-à-dire sur la
 * seule page qu'un commerçant ne consulte jamais tant que tout fonctionne. Il
 * découvrait donc la fin de son abonnement le jour où son tableau de bord
 * disparaissait derrière le mur de paiement.
 *
 * Le bandeau n'est pas masquable : ce n'est pas une information dont on prend
 * acte, c'est une action à faire avant une date. Il disparaît de lui-même dès
 * que l'abonnement est reconduit.
 *
 * Il ne s'affiche pas en permanence pour autant — un avertissement qui ne
 * demande rien cesse d'être lu. Deux situations seulement le déclenchent :
 * l'abonnement est terminé, ou il se termine dans les jours qui viennent.
 */

/** Fenêtre d'avertissement avant l'échéance. */
const WARNING_DAYS = 7;

function daysUntil(target: string): number {
  const diff = new Date(target).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function SubscriptionAlert({
  currentPeriodEnd,
  isActive,
  href,
  canManage,
}: {
  /** Fin de la période en cours, au format ISO. `null` si aucun abonnement. */
  currentPeriodEnd: string | null;
  isActive: boolean;
  /** Page d'abonnement du produit concerné. */
  href: string;
  /**
   * Un employé ne peut pas payer. Lui montrer un bouton qui le mènerait à un
   * écran sans action serait une impasse : il voit l'information, sans
   * l'invitation à agir.
   */
  canManage: boolean;
}) {
  // Recalculé chaque heure : un tableau de bord de caisse reste ouvert toute
  // la journée, et « dans 1 jour » ne doit pas y rester affiché le lendemain.
  const [days, setDays] = useState(() => (currentPeriodEnd ? daysUntil(currentPeriodEnd) : null));

  useEffect(() => {
    if (!currentPeriodEnd) return;
    const id = setInterval(() => setDays(daysUntil(currentPeriodEnd)), 3_600_000);
    return () => clearInterval(id);
  }, [currentPeriodEnd]);

  const ended = !isActive;
  const endingSoon = isActive && days !== null && days <= WARNING_DAYS;

  if (!ended && !endingSoon) return null;

  const message = ended
    ? 'Votre abonnement est terminé.'
    : days !== null && days <= 0
      ? "Votre abonnement se termine aujourd'hui."
      : `Votre abonnement se termine dans ${days} jour${days! > 1 ? 's' : ''}.`;

  return (
    <div
      role="status"
      className={
        ended
          ? 'flex flex-wrap items-center justify-between gap-3 border-b border-state-bad/30 bg-state-bad-soft px-4 py-2.5 text-sm text-state-bad sm:px-6'
          : 'flex flex-wrap items-center justify-between gap-3 border-b border-state-warn/30 bg-state-warn-soft px-4 py-2.5 text-sm text-state-warn sm:px-6'
      }
    >
      <p className="font-medium">
        {message}{' '}
        <span className="font-normal">
          {ended
            ? 'Vos données sont intactes et vous attendent.'
            : 'Reconduisez-le pour ne pas perdre l’accès.'}
        </span>
      </p>

      {canManage && (
        <Link
          href={href}
          className={
            ended
              ? 'shrink-0 rounded-lg bg-state-bad px-3 py-1.5 font-medium text-white'
              : 'shrink-0 rounded-lg bg-state-warn px-3 py-1.5 font-medium text-white'
          }
        >
          Reconduire mon abonnement
        </Link>
      )}
    </div>
  );
}
