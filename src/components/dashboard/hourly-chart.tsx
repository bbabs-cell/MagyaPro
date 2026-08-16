'use client';

import { useState } from 'react';

/**
 * Répartition horaire des commandes — série unique, barres verticales.
 *
 * Une seule série, donc pas de légende : le titre de la carte nomme la mesure.
 * Les barres sont fines, ancrées à la ligne de base, avec des extrémités
 * arrondies et un écart de surface entre elles. Le tableau replié rend les
 * mêmes chiffres accessibles au clavier et aux lecteurs d'écran.
 */
export function HourlyActivityChart({
  data,
}: {
  data: Array<{ hour: number; orders: number }>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.map((point) => point.orders), 1);
  const total = data.reduce((sum, point) => sum + point.orders, 0);
  const peak = data.reduce((best, point) => (point.orders > best.orders ? point : best), data[0]!);

  if (total === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Aucune commande sur la période : la répartition horaire apparaîtra
        ensuite.
      </p>
    );
  }

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Nombre de commandes par heure de la journée. Pic à {peak.hour} h avec{' '}
        {peak.orders} commandes.
      </figcaption>

      <div
        className="flex h-32 items-end gap-[2px]"
        onMouseLeave={() => setHovered(null)}
      >
        {data.map((point) => {
          const height = (point.orders / max) * 100;
          const isActive = hovered === point.hour;

          return (
            <div
              key={point.hour}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHovered(point.hour)}
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  isActive ? 'bg-ink' : 'bg-ink/25'
                }`}
                style={{ height: `${Math.max(height, point.orders > 0 ? 4 : 1)}%` }}
              />

              {isActive && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white">
                  {point.hour} h · {point.orders} commande
                  {point.orders > 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
        <span>0 h</span>
        <span>12 h</span>
        <span>23 h</span>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          Afficher les données sous forme de tableau
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Commandes par heure</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="text-ink-faint">
                <th scope="col" className="py-1 font-medium">Heure</th>
                <th scope="col" className="py-1 text-right font-medium">Commandes</th>
              </tr>
            </thead>
            <tbody>
              {data
                .filter((point) => point.orders > 0)
                .map((point) => (
                  <tr key={point.hour} className="border-t border-surface-border">
                    <td className="py-1">{point.hour} h</td>
                    <td className="py-1 text-right">{point.orders}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
