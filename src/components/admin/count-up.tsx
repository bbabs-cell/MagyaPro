'use client';

import { useEffect, useState } from 'react';

/**
 * Nombre entier qui monte jusqu'à sa valeur à l'affichage.
 *
 * Le chiffre final est rendu côté serveur : sans JavaScript, sur une
 * connexion lente ou pour un lecteur d'écran (qui lit la version masquée),
 * il est juste dès le premier affichage. L'animation ne fait que le rejouer
 * une fois, en 0,9 s décélérée, et elle est sautée pour qui a demandé moins
 * d'animations dans son système.
 */
export function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // Décélération (ease-out cubique) : vite au départ, posé à l'arrivée.
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <>
      <span aria-hidden="true">{shown.toLocaleString('fr-FR')}</span>
      <span className="sr-only">{value.toLocaleString('fr-FR')}</span>
    </>
  );
}
