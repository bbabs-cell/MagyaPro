'use client';

import { useEffect, useState } from 'react';

/** Temps restant avant `target`, recalculé chaque minute. */
function remaining(target: string): { days: number; hours: number; over: boolean } {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, over: true };

  const totalMinutes = Math.floor(diff / 60000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    over: false,
  };
}

/** Compte à rebours jusqu'à la fin de la période en cours de l'abonnement. */
export function PlanCountdown({ currentPeriodEnd }: { currentPeriodEnd: string }) {
  const [time, setTime] = useState(() => remaining(currentPeriodEnd));

  useEffect(() => {
    const id = setInterval(() => setTime(remaining(currentPeriodEnd)), 60_000);
    return () => clearInterval(id);
  }, [currentPeriodEnd]);

  if (time.over) {
    return <p className="mt-1 text-sm font-medium text-red-600">Période expirée</p>;
  }

  return (
    <p className="mt-1 text-sm">
      <span className="font-semibold text-ink">
        {time.days > 0 ? `${time.days} j ${time.hours} h` : `${time.hours} h`}
      </span>
      <span className="text-ink-muted"> restants</span>
    </p>
  );
}
