'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card, cx, inputClass } from '@/components/ui';

/** TVA appliquée automatiquement à chaque vente en caisse — voir `Store.taxRate` (dixièmes de %). */
export function TaxSettingsPanel({
  taxEnabled,
  taxRate,
  canManage,
}: {
  taxEnabled: boolean;
  taxRate: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(taxEnabled);
  const [rate, setRate] = useState((taxRate / 10).toString());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      await api.patch('/api/boutique/parametres', {
        taxEnabled: enabled,
        taxRate: Math.round(Number(rate) * 10),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le réglage n'a pas pu être enregistré.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">TVA</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Appliquée automatiquement au total de chaque vente en caisse.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Réglage enregistré.
        </div>
      )}

      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={!canManage}
            className="accent-ink"
          />
          Appliquer la TVA en caisse
        </label>

        {enabled && (
          <div>
            <label htmlFor="taxRate" className="block text-sm font-medium text-ink">
              Taux (%)
            </label>
            <input
              id="taxRate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              disabled={!canManage}
              className={cx(inputClass, 'mt-1.5 max-w-32')}
            />
          </div>
        )}

        {canManage && (
          <Button type="submit" size="sm" loading={pending}>
            Enregistrer
          </Button>
        )}
      </form>
    </Card>
  );
}
