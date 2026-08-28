'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card, Field, cx, inputClass } from '@/components/ui';
import { formatCompositeStock, type UnitOption } from '@/lib/boutique/units';

/**
 * Retrait de stock avec motif.
 *
 * À distinguer de l'archivage (le produit sort du catalogue) et de la
 * suppression (le produit disparaît) : ici le produit reste vendable, seule
 * sa quantité baisse. Le motif est obligatoire — un stock qui diminue sans
 * explication rend l'inventaire incompréhensible trois mois plus tard.
 */

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'LOSS', label: 'Perte' },
  { value: 'BREAKAGE', label: 'Casse' },
  { value: 'EXPIRED', label: 'Produit expiré' },
  { value: 'GIFT', label: 'Produit offert' },
  { value: 'PERSONAL', label: 'Utilisation personnelle' },
  { value: 'INVENTORY_FIX', label: "Correction d'inventaire" },
  { value: 'SUPPLIER_RETURN', label: 'Retour fournisseur' },
  { value: 'OTHER', label: 'Autre' },
];

export function StockWithdrawalForm({
  productName,
  variantId,
  variantLabel,
  stock,
  units,
  onDone,
  onCancel,
}: {
  productName: string;
  variantId: string;
  /** « M · Noir » pour un produit à déclinaisons, sinon vide. */
  variantLabel?: string;
  /** Stock actuel, en unité de base. */
  stock: number;
  units: UnitOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units.find((unit) => unit.isBase)?.unitId ?? '');
  const [quantity, setQuantity] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = units.find((candidate) => candidate.unitId === unitId) ?? null;
  const factor = unit?.factor ?? 1;
  const entered = Number(quantity) || 0;
  const baseQuantity = Math.round(entered * factor * 1_000_000) / 1_000_000;
  const after = Math.round((stock - baseQuantity) * 1_000_000) / 1_000_000;
  const tooMuch = baseQuantity > stock;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    try {
      await api.post('/api/boutique/stock/retrait', {
        productVariantId: variantId,
        quantity: entered,
        ...(unit && !unit.isBase ? { unitId: unit.unitId } : {}),
        reason: String(formData.get('reason') ?? 'OTHER'),
        note: String(formData.get('note') ?? '') || undefined,
      });
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le retrait n'a pas pu être enregistré.");
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">
        Retirer du stock — {productName}
        {variantLabel && <span className="font-normal text-ink-muted"> ({variantLabel})</span>}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Le produit reste en vente. Seule sa quantité diminue, et le mouvement est journalisé
        avec son motif.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantité à retirer" htmlFor="withdraw-qty" required>
            <input
              id="withdraw-qty"
              type="number"
              min="0"
              step={unit?.isDecimal && unit.isBase ? '0.000001' : '1'}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={cx(inputClass, tooMuch && 'border-state-bad')}
            />
          </Field>
          {units.length > 1 && (
            <Field label="Unité" htmlFor="withdraw-unit">
              <select
                id="withdraw-unit"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                className={inputClass}
              >
                {units.map((candidate) => (
                  <option key={candidate.unitId} value={candidate.unitId}>
                    {candidate.isBase
                      ? candidate.label
                      : `${candidate.label} (×${candidate.factor})`}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Motif" htmlFor="reason" required>
          <select id="reason" name="reason" required className={inputClass}>
            {REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Commentaire (facultatif)" htmlFor="note">
          <input id="note" name="note" maxLength={300} className={inputClass} />
        </Field>

        {/* Le résultat est annoncé avant validation : un retrait est
            irréversible sans mouvement inverse, et se tromper d'unité est
            l'erreur la plus coûteuse ici. */}
        <div className="rounded-xl bg-surface-sunken px-4 py-3 text-sm">
          <p className="text-ink-muted">
            Stock actuel : <strong className="text-ink">{formatCompositeStock(stock, units)}</strong>
          </p>
          {entered > 0 && (
            <p className={cx('mt-1', tooMuch ? 'text-state-bad' : 'text-ink-muted')}>
              {tooMuch ? (
                <>Retrait supérieur au stock disponible.</>
              ) : (
                <>
                  Après retrait :{' '}
                  <strong className="text-ink">{formatCompositeStock(after, units)}</strong>
                  {unit && !unit.isBase && (
                    <span className="text-ink-faint"> ({baseQuantity} au total)</span>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={pending} disabled={entered <= 0 || tooMuch}>
            Confirmer le retrait
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
