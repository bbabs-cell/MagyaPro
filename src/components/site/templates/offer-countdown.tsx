'use client';

import { useEffect, useState } from 'react';

/** Compte à rebours jusqu'à `endsAt`, remis à jour chaque seconde côté client. */
function remaining(endsAt: string): { h: string; m: string; s: string; over: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { h: '00', m: '00', s: '00', over: true };

  const totalSeconds = Math.floor(diff / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    h: pad(Math.floor(totalSeconds / 3600)),
    m: pad(Math.floor((totalSeconds % 3600) / 60)),
    s: pad(totalSeconds % 60),
    over: false,
  };
}

export function OfferCountdown({ endsAt }: { endsAt: string }) {
  const [time, setTime] = useState(() => remaining(endsAt));

  useEffect(() => {
    const id = setInterval(() => setTime(remaining(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (time.over) return null;

  return (
    <div className="flex gap-3">
      {[
        { label: 'Heures', value: time.h },
        { label: 'Minutes', value: time.m },
        { label: 'Secondes', value: time.s },
      ].map((item) => (
        <div key={item.label} className="rounded-2xl bg-black/25 px-4 py-2.5 text-center backdrop-blur">
          <span className="block font-display text-2xl font-bold tabular-nums">{item.value}</span>
          <span className="text-[0.65rem] uppercase tracking-wide text-white/70">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
