'use client';

import { useMemo, useState } from 'react';

import { Badge, Card, cx, inputClass } from '@/components/ui';
import { formatCompositeStock, type UnitOption } from '@/lib/boutique/units';
import {
  STOCK_LEVEL_ICONS,
  STOCK_LEVEL_LABELS,
  type StockLevel,
} from '@/lib/boutique/stock-forecast';

/**
 * Tableau de prévision des ruptures.
 *
 * Chaque ligne répond à trois questions dans l'ordre où le commerçant se les
 * pose : combien m'en reste-t-il, combien de temps ça tient, combien dois-je
 * commander.
 */

export type ForecastRow = {
  productId: string;
  name: string;
  level: StockLevel;
  stock: number;
  dailySales: number;
  daysLeft: number | null;
  recommendedQuantity: number;
  reliable: boolean;
  units: UnitOption[];
};

const LEVEL_TONE: Record<StockLevel, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  low: 'warning',
  imminent: 'warning',
  out: 'danger',
};

const LEVEL_ORDER: StockLevel[] = ['out', 'imminent', 'low', 'ok'];

export function StockForecastTable({
  rows,
  baseUnitLabel,
}: {
  rows: ForecastRow[];
  /** Libellé d'unité de repli, pour une fiche sans unité de base. */
  baseUnitLabel: string;
}) {
  const [filter, setFilter] = useState<StockLevel | 'all'>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const map = { ok: 0, low: 0, imminent: 0, out: 0 } as Record<StockLevel, number>;
    for (const row of rows) map[row.level] += 1;
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter((row) => (filter === 'all' ? true : row.level === filter))
      .filter((row) => (needle ? row.name.toLowerCase().includes(needle) : true))
      // Le plus urgent d'abord : une liste triée par nom obligerait à
      // chercher les ruptures au milieu des produits qui vont bien.
      .sort(
        (a, b) =>
          LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
          (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity),
      );
  }, [rows, filter, query]);

  function stockLabel(row: ForecastRow): string {
    return row.units.length > 0
      ? formatCompositeStock(row.stock, row.units)
      : `${row.stock} ${baseUnitLabel}`.trim();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {LEVEL_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={filter === level}
            onClick={() => setFilter(filter === level ? 'all' : level)}
            className={cx(
              'card card-interactive p-4 text-left',
              filter === level && 'ring-2 ring-ink',
            )}
          >
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <span aria-hidden="true">{STOCK_LEVEL_ICONS[level]}</span>
              {STOCK_LEVEL_LABELS[level]}
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-ink">
              {counts[level]}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un produit…"
        className={inputClass}
      />

      {visible.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun produit ne correspond à cette sélection.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Ventes / jour</th>
                <th className="px-4 py-3 text-right font-medium">Rupture dans</th>
                <th className="px-4 py-3 text-right font-medium">À commander</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.productId} className="border-b border-surface-border last:border-0">
                  <td data-label="Produit" className="px-4 py-3 font-medium">
                    {row.name}
                  </td>
                  <td data-label="État" className="px-4 py-3">
                    <Badge tone={LEVEL_TONE[row.level]}>
                      {STOCK_LEVEL_ICONS[row.level]} {STOCK_LEVEL_LABELS[row.level]}
                    </Badge>
                  </td>
                  <td data-label="Stock" className="px-4 py-3 text-right tabular-nums">
                    {stockLabel(row)}
                  </td>
                  <td data-label="Ventes / jour" className="px-4 py-3 text-right tabular-nums">
                    {row.dailySales > 0 ? row.dailySales.toLocaleString('fr-FR') : '—'}
                  </td>
                  <td data-label="Rupture dans" className="px-4 py-3 text-right tabular-nums">
                    {row.daysLeft === null ? (
                      <span className="text-ink-faint">Aucune vente</span>
                    ) : (
                      <>
                        {Math.floor(row.daysLeft)} j
                        {!row.reliable && (
                          // Annoncer l'incertitude plutôt que de la masquer :
                          // une prévision sur trois jours d'historique n'a pas
                          // la même valeur qu'une prévision sur un mois.
                          <span
                            title="Historique encore court : estimation approximative."
                            className="ml-1 text-ink-faint"
                          >
                            ≈
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td data-label="À commander" className="px-4 py-3 text-right font-medium tabular-nums">
                    {row.recommendedQuantity > 0
                      ? row.recommendedQuantity.toLocaleString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-ink-faint">
        Calculé sur vos ventes des 30 derniers jours, en donnant plus de poids à la semaine
        écoulée. Aucun service externe n&apos;est consulté : ces chiffres viennent uniquement de
        vos propres mouvements de stock.
      </p>
    </div>
  );
}
