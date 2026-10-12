'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { formatCompositeStock, stepForUnit, type UnitOption } from '@/lib/boutique/units';
import {
  countDifference,
  countedBaseQuantity,
  summarizeCount,
  type CountLine,
  type CountParts,
} from '@/lib/boutique/stock-count';
import { BarcodeScannerButton, type ScanResult } from '@/components/boutique/barcode-scanner';
import { AlertMessage, Badge, Button, Card, LinkButton, cx, inputClass } from '@/components/ui';

export type CountItem = {
  variantId: string;
  productName: string;
  variantLabel: string | null;
  categoryId: string | null;
  sku: string | null;
  barcode: string | null;
  /** Stock enregistré, en unité de base. */
  stock: number;
  /** Coût d'achat d'une unité de base, en unité mineure. */
  unitCost: number;
  units: UnitOption[];
};

/** Un comptage en cours, ligne par ligne. */
type DraftEntry = {
  parts: CountParts;
  /** Stock affiché au moment où la ligne a été comptée — voir `stock-count.ts`. */
  expected: number;
};

type Draft = { v: 1; counts: Record<string, DraftEntry> };

const ALL = '__all__';
const NONE = '__none__';

/**
 * Le comptage est gardé sur l'appareil à chaque saisie : un inventaire prend
 * souvent plus d'une heure, et un appel, une batterie vide ou un onglet fermé
 * ne doivent pas le faire recommencer. Le stockage peut être indisponible
 * (navigation privée) : on compte alors sans filet, sans erreur.
 */
function storageKey(storeId: string) {
  return `magyapro:inventaire:${storeId}`;
}

function readDraft(storeId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return parsed?.v === 1 && parsed.counts && typeof parsed.counts === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(storeId: string, draft: Draft | null) {
  try {
    if (!draft || Object.keys(draft.counts).length === 0) {
      window.localStorage.removeItem(storageKey(storeId));
    } else {
      window.localStorage.setItem(storageKey(storeId), JSON.stringify(draft));
    }
  } catch {
    // Stockage plein ou bloqué : le comptage continue en mémoire.
  }
}

/** Recherche sans accents ni casse : « cafe » trouve « Café ». */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Les unités proposées à la saisie : la plus grande unité de regroupement
 * (le carton) puis l'unité de base. Compter « 3 cartons + 4 bouteilles » est
 * ce qu'on fait devant l'étagère ; demander 64 obligerait à calculer de tête.
 */
function countingUnits(units: UnitOption[]): UnitOption[] {
  const base = units.find((unit) => unit.isBase) ?? units[0];
  if (!base) return [];
  if (base.isDecimal) return [base];
  const pack = units
    .filter((unit) => !unit.isBase && !unit.isDecimal && unit.factor > 1)
    .sort((a, b) => b.factor - a.factor)[0];
  return pack ? [pack, base] : [base];
}

/**
 * Écart en unité de base seulement : « −57 bouteilles » se lit d'un coup,
 * « −4 cartons + 9 bouteilles » laisse croire que les 9 bouteilles sont en trop.
 */
function formatGap(gap: number, units: UnitOption[]): string {
  if (gap === 0) return 'Conforme';
  const base = units.filter((unit) => unit.isBase);
  return `${gap > 0 ? '+' : '−'}${formatCompositeStock(Math.abs(gap), base.length > 0 ? base : units)}`;
}

export function StockCount({
  storeId,
  categories,
  items,
  currency,
  lastCountAt,
}: {
  storeId: string;
  categories: Array<{ id: string; name: string }>;
  items: CountItem[];
  currency: string;
  lastCountAt: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ v: 1, counts: {} });
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<'count' | 'review' | 'done'>('count');
  const [shelf, setShelf] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [hideCounted, setHideCounted] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ counted: number; adjusted: number } | null>(null);

  // Lu après le montage : le serveur ne connaît pas le brouillon de l'appareil.
  useEffect(() => {
    const saved = readDraft(storeId);
    if (saved) setDraft(saved);
    setLoaded(true);
  }, [storeId]);

  useEffect(() => {
    if (loaded) writeDraft(storeId, draft);
  }, [draft, loaded, storeId]);

  // Le stock attendu des lignes pas encore comptées suit les ventes du jour.
  useEffect(() => {
    if (step !== 'count') return;
    const timer = window.setInterval(() => router.refresh(), 120_000);
    return () => window.clearInterval(timer);
  }, [router, step]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.variantId, item])), [items]);

  const countedQuantity = (variantId: string): number | null => {
    const entry = draft.counts[variantId];
    const item = itemById.get(variantId);
    if (!entry || !item) return null;
    return countedBaseQuantity(entry.parts, item.units);
  };

  const lines: Array<CountLine & { item: CountItem }> = useMemo(
    () =>
      Object.entries(draft.counts).flatMap(([variantId, entry]) => {
        const item = itemById.get(variantId);
        if (!item) return [];
        const counted = countedBaseQuantity(entry.parts, item.units);
        if (counted === null) return [];
        return [{ variantId, counted, expected: entry.expected, unitCost: item.unitCost, item }];
      }),
    [draft, itemById],
  );
  const summary = summarizeCount(lines);

  const shelves = useMemo(() => {
    const total = new Map<string, number>();
    const done = new Map<string, number>();
    const countedIds = new Set(lines.map((line) => line.variantId));
    for (const item of items) {
      const key = item.categoryId ?? NONE;
      total.set(key, (total.get(key) ?? 0) + 1);
      if (countedIds.has(item.variantId)) done.set(key, (done.get(key) ?? 0) + 1);
    }
    const list = categories
      .filter((category) => total.has(category.id))
      .map((category) => ({
        key: category.id,
        name: category.name,
        total: total.get(category.id) ?? 0,
        done: done.get(category.id) ?? 0,
      }));
    if (total.has(NONE)) {
      list.push({ key: NONE, name: 'Sans rayon', total: total.get(NONE) ?? 0, done: done.get(NONE) ?? 0 });
    }
    return list;
  }, [categories, items, lines]);

  const visible = useMemo(() => {
    const query = normalize(search.trim());
    return items.filter((item) => {
      if (shelf !== ALL && (item.categoryId ?? NONE) !== shelf) return false;
      if (hideCounted && lines.some((line) => line.variantId === item.variantId)) return false;
      if (!query) return true;
      return [item.productName, item.variantLabel, item.sku, item.barcode]
        .filter(Boolean)
        .some((value) => normalize(value!).includes(query));
    });
  }, [items, shelf, hideCounted, lines, search]);

  function setPart(item: CountItem, unitId: string, value: string) {
    setDraft((current) => {
      const previous = current.counts[item.variantId];
      const parts = { ...(previous?.parts ?? {}), [unitId]: value };
      const counts = { ...current.counts };
      if (Object.values(parts).every((part) => part.trim() === '')) {
        delete counts[item.variantId];
      } else {
        // Le stock attendu est figé à la première saisie de la ligne.
        counts[item.variantId] = { parts, expected: previous?.expected ?? item.stock };
      }
      return { ...current, counts };
    });
  }

  function markAsExpected(item: CountItem) {
    const base = item.units.find((unit) => unit.isBase) ?? item.units[0];
    if (!base) return;
    setDraft((current) => ({
      ...current,
      counts: {
        ...current.counts,
        [item.variantId]: { parts: { [base.unitId]: String(Math.max(0, item.stock)) }, expected: item.stock },
      },
    }));
  }

  function restart() {
    if (
      lines.length > 0 &&
      !window.confirm('Effacer le comptage en cours ? Les quantités saisies seront perdues.')
    ) {
      return;
    }
    setDraft({ v: 1, counts: {} });
    setStep('count');
    setResult(null);
    setNote('');
    setError(null);
  }

  function handleScan(code: string): ScanResult {
    const value = code.trim();
    const found = items.find((item) => item.barcode === value || item.sku === value);
    if (!found) return { ok: false, message: `Code ${value} inconnu.` };
    setShelf(ALL);
    setHideCounted(false);
    setSearch(found.barcode === value ? value : (found.sku ?? value));
    // Le champ n'existe qu'après le rendu filtré.
    window.setTimeout(() => {
      const input = document.getElementById(`count-${found.variantId}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 350);
    return { ok: true, message: `${found.productName} : saisissez la quantité.` };
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await api.post<{ counted: number; adjusted: number }>(
        '/api/boutique/stock/inventaire',
        {
          lines: lines.map((line) => ({
            productVariantId: line.variantId,
            counted: line.counted,
            expected: line.expected,
          })),
          note: note.trim() || undefined,
        },
      );
      setResult(response);
      setDraft({ v: 1, counts: {} });
      setStep('done');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'inventaire n'a pas pu être enregistré. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  if (step === 'done' && result) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-semibold text-ink">Inventaire enregistré</p>
        <p className="mt-1 text-sm text-ink-muted">
          {result.counted} produit{result.counted > 1 ? 's' : ''} compté{result.counted > 1 ? 's' : ''},{' '}
          {result.adjusted === 0
            ? 'aucun écart : votre stock était juste.'
            : `${result.adjusted} stock${result.adjusted > 1 ? 's' : ''} corrigé${result.adjusted > 1 ? 's' : ''}.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <LinkButton href="/boutique/dashboard/mouvements?type=ADJUSTMENT" variant="secondary">
            Voir les corrections
          </LinkButton>
          <Button type="button" onClick={restart}>
            Nouvel inventaire
          </Button>
        </div>
      </Card>
    );
  }

  if (step === 'review') {
    const gaps = lines
      .map((line) => ({ ...line, gap: countDifference(line.counted, line.expected) }))
      .filter((line) => line.gap !== 0)
      .sort((a, b) => Math.abs(b.gap * b.unitCost) - Math.abs(a.gap * a.unitCost));
    const uncounted = items.length - summary.counted;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Produits comptés</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{summary.counted}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Conformes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{summary.matching}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">Manquant (au coût d&apos;achat)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-state-bad">
              {summary.missingValue > 0 ? '−' : ''}
              {formatMoney(summary.missingValue, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted">En trop</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-state-ok">
              {summary.surplusValue > 0 ? '+' : ''}
              {formatMoney(summary.surplusValue, currency)}
            </p>
          </Card>
        </div>

        <Card className="p-4 sm:p-5">
          <h2 className="font-medium text-ink">
            {gaps.length === 0
              ? 'Aucun écart'
              : `${gaps.length} écart${gaps.length > 1 ? 's' : ''} à corriger`}
          </h2>
          {gaps.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">
              Tout ce que vous avez compté correspond au stock enregistré.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-border">
              {gaps.map((line) => (
                <li key={line.variantId} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {line.item.productName}
                      {line.item.variantLabel && (
                        <span className="font-normal text-ink-muted"> · {line.item.variantLabel}</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Attendu {formatCompositeStock(line.expected, line.item.units)} · compté{' '}
                      {formatCompositeStock(line.counted, line.item.units)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={line.gap < 0 ? 'danger' : 'success'}>{formatGap(line.gap, line.item.units)}</Badge>
                    {line.unitCost > 0 && (
                      <p className="mt-1 text-xs tabular-nums text-ink-muted">
                        {line.gap < 0 ? '−' : '+'}
                        {formatMoney(Math.round(Math.abs(line.gap) * line.unitCost), currency)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {uncounted > 0 && (
            <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
              {uncounted} produit{uncounted > 1 ? 's' : ''} non compté{uncounted > 1 ? 's' : ''} : leur stock ne
              change pas.
            </p>
          )}
        </Card>

        <Card className="space-y-3 p-4 sm:p-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">Note (facultatif)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              placeholder="Ex. inventaire de fin de mois"
              className={cx(inputClass, 'mt-1.5')}
            />
          </label>
          <p className="text-xs text-ink-muted">
            Chaque correction est inscrite dans Entrées et sorties, avec la quantité comptée, l&apos;attendu et
            votre nom. Les ventes faites pendant le comptage restent prises en compte.
          </p>
          <AlertMessage message={error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setStep('count')} disabled={pending}>
              Revenir au comptage
            </Button>
            <Button type="button" onClick={submit} loading={pending}>
              {gaps.length === 0 ? "Clore l'inventaire" : `Corriger ${gaps.length} stock${gaps.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const progress = items.length > 0 ? Math.round((summary.counted / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              <span className="tabular-nums">{summary.counted}</span> sur{' '}
              <span className="tabular-nums">{items.length}</span> produits comptés
              {summary.withGap > 0 && (
                <span className="text-ink-muted">
                  {' '}
                  · {summary.withGap} écart{summary.withGap > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted" suppressHydrationWarning>
              {lastCountAt
                ? `Dernier inventaire le ${new Date(lastCountAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                : 'Premier inventaire de la boutique.'}{' '}
              Votre comptage est gardé sur cet appareil jusqu&apos;à la validation.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {summary.counted > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={restart}>
                Recommencer
              </Button>
            )}
            <Button type="button" size="sm" disabled={summary.counted === 0} onClick={() => setStep('review')}>
              Voir les écarts
            </Button>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement de l'inventaire"
        >
          <div className="h-full rounded-full bg-brand-strong transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 pb-1" role="tablist" aria-label="Rayons">
          {[{ key: ALL, name: 'Tous les rayons', total: items.length, done: summary.counted }, ...shelves].map(
            (entry) => {
              const active = shelf === entry.key;
              const complete = entry.total > 0 && entry.done === entry.total;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setShelf(entry.key)}
                  className={cx(
                    'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors',
                    active
                      ? 'border-brand-strong bg-brand-strong text-brand-ink'
                      : 'border-surface-border bg-surface text-ink hover:border-ink-faint',
                  )}
                >
                  <span className="whitespace-nowrap">{entry.name}</span>
                  <span
                    className={cx(
                      'tabular-nums text-xs',
                      active ? 'opacity-80' : complete ? 'text-state-ok' : 'text-ink-muted',
                    )}
                  >
                    {complete ? '✓ ' : ''}
                    {entry.done}/{entry.total}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nom, référence ou code-barres"
          aria-label="Chercher un produit"
          className={inputClass}
        />
        <BarcodeScannerButton onDetect={handleScan} iconOnly className="shrink-0" />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideCounted}
            onChange={(event) => setHideCounted(event.target.checked)}
            className="h-4 w-4 accent-brand-strong"
          />
          Masquer les produits comptés
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showExpected}
            onChange={(event) => setShowExpected(event.target.checked)}
            className="h-4 w-4 accent-brand-strong"
          />
          Afficher le stock attendu
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-surface-border px-4 py-10 text-center text-sm text-ink-muted">
          {hideCounted && !search ? 'Tout est compté dans ce rayon.' : 'Aucun produit ne correspond.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const entry = draft.counts[item.variantId];
            const counted = countedQuantity(item.variantId);
            const expected = entry?.expected ?? item.stock;
            const gap = counted === null ? null : countDifference(counted, expected);
            const fields = countingUnits(item.units);

            return (
              <li key={item.variantId}>
                <Card
                  className={cx(
                    'flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between',
                    counted !== null && 'border-l-4 border-l-state-ok',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.productName}
                      {item.variantLabel && (
                        <span className="font-normal text-ink-muted"> · {item.variantLabel}</span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      {item.sku && <span>Réf. {item.sku}</span>}
                      {showExpected && (
                        <span>Attendu : {formatCompositeStock(expected, item.units)}</span>
                      )}
                      {counted !== null && (showExpected || gap === 0) && gap !== null && (
                        <span className={gap < 0 ? 'text-state-bad' : gap > 0 ? 'text-state-ok' : ''}>
                          {gap === 0 ? '✓ Conforme' : formatGap(gap, item.units)}
                        </span>
                      )}
                      {counted !== null && !showExpected && gap !== 0 && <span>✓ Compté</span>}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {fields.map((unit, index) => (
                      <label key={unit.unitId} className="flex items-center gap-1.5">
                        {index > 0 && <span aria-hidden="true" className="text-ink-faint">+</span>}
                        <input
                          id={index === 0 ? `count-${item.variantId}` : undefined}
                          type="number"
                          inputMode={unit.isDecimal ? 'decimal' : 'numeric'}
                          min={0}
                          step={unit.isDecimal ? 'any' : stepForUnit(unit)}
                          value={entry?.parts[unit.unitId] ?? ''}
                          onChange={(event) => setPart(item, unit.unitId, event.target.value)}
                          placeholder="—"
                          aria-label={`${item.productName}${item.variantLabel ? ` ${item.variantLabel}` : ''} : ${unit.labelPlural}`}
                          className={cx(inputClass, 'max-w-[5.5rem] px-2.5 py-2 text-center tabular-nums')}
                        />
                        <span className="text-xs text-ink-muted">{unit.labelPlural}</span>
                      </label>
                    ))}
                    {showExpected && counted === null && item.stock >= 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => markAsExpected(item)}>
                        Conforme
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {summary.counted > 0 && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setStep('review')}>
            Voir les écarts ({summary.counted} compté{summary.counted > 1 ? 's' : ''})
          </Button>
        </div>
      )}
    </div>
  );
}
