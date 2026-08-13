'use client';

import { useMemo, useState } from 'react';

import { formatMoney } from '@/lib/money';

/**
 * Évolution du chiffre d'affaires — série unique.
 *
 * Une seule série : pas de légende, le titre de la carte nomme la mesure. Un
 * seul axe de valeurs, jamais deux échelles superposées. Les repères sont
 * volontairement discrets, la ligne porte l'information.
 *
 * Un tableau équivalent est rendu sous le graphique (replié) : les données
 * restent accessibles au clavier et aux lecteurs d'écran, qui ne peuvent rien
 * faire d'un tracé SVG.
 */

type Point = { date: string; revenue: number; orders: number };

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 28, left: 12 };

export function RevenueChart({
  points,
  currency,
}: {
  points: Point[];
  currency: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const max = Math.max(...points.map((p) => p.revenue), 1);
    const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

    const coords = points.map((point, index) => ({
      x:
        PADDING.left +
        (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
      y: PADDING.top + innerHeight - (point.revenue / max) * innerHeight,
    }));

    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');

    const baseline = PADDING.top + innerHeight;
    const area =
      coords.length > 0
        ? `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${baseline} L${coords[0]!.x.toFixed(1)},${baseline} Z`
        : '';

    return { coords, line, area, max, baseline };
  }, [points]);

  if (points.length === 0) return null;

  const active = hovered === null ? null : points[hovered];
  const activeCoord = hovered === null ? null : geometry.coords[hovered];

  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  const peak = points.reduce((best, p) => (p.revenue > best.revenue ? p : best), points[0]!);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Chiffre d&apos;affaires quotidien sur {points.length} jours, total{' '}
        {formatMoney(total, currency)}.
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-48 w-full touch-none"
          role="img"
          aria-label={`Évolution du chiffre d'affaires. Total ${formatMoney(total, currency)}. Meilleur jour : ${formatDay(peak.date)} avec ${formatMoney(peak.revenue, currency)}.`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Repères horizontaux, en retrait derrière la donnée. */}
          {[0, 0.5, 1].map((ratio) => {
            const y = PADDING.top + (VIEW_HEIGHT - PADDING.top - PADDING.bottom) * ratio;
            return (
              <line
                key={ratio}
                x1={PADDING.left}
                x2={VIEW_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#e4e8ed"
                strokeWidth="1"
              />
            );
          })}

          <path d={geometry.area} fill="#12151a" fillOpacity="0.06" />
          <path
            d={geometry.line}
            fill="none"
            stroke="#12151a"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {activeCoord && (
            <>
              <line
                x1={activeCoord.x}
                x2={activeCoord.x}
                y1={PADDING.top}
                y2={geometry.baseline}
                stroke="#8b95a2"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {/* Anneau de surface : le marqueur reste lisible par-dessus la ligne. */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="5"
                fill="#12151a"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </>
          )}

          {/* Zones de survol larges : viser un point de 2 px serait impraticable. */}
          {geometry.coords.map((coord, index) => (
            <rect
              key={index}
              x={coord.x - VIEW_WIDTH / points.length / 2}
              y={0}
              width={VIEW_WIDTH / points.length}
              height={VIEW_HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
            />
          ))}
        </svg>

        {active && activeCoord && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-sm"
            style={{
              left: `${(activeCoord.x / VIEW_WIDTH) * 100}%`,
              top: `${(activeCoord.y / VIEW_HEIGHT) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <p className="font-medium">{formatMoney(active.revenue, currency)}</p>
            <p className="text-white/70">
              {formatDay(active.date)} · {active.orders} commande
              {active.orders > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-xs text-ink-faint">
        <span>{formatDay(points[0]!.date)}</span>
        <span>{formatDay(points[points.length - 1]!.date)}</span>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          Afficher les données sous forme de tableau
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Chiffre d&apos;affaires et nombre de commandes par jour
            </caption>
            <thead className="sticky top-0 bg-white">
              <tr className="text-ink-faint">
                <th scope="col" className="py-1 font-medium">Date</th>
                <th scope="col" className="py-1 text-right font-medium">Commandes</th>
                <th scope="col" className="py-1 text-right font-medium">CA</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-surface-border">
                  <td className="py-1">{formatDay(point.date)}</td>
                  <td className="py-1 text-right">{point.orders}</td>
                  <td className="py-1 text-right">
                    {formatMoney(point.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}
