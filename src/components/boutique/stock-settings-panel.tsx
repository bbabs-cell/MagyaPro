'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card } from '@/components/ui';

/** Vente à découvert — voir `Store.allowNegativeStock` et `recordStockMovement`. */
export function StockSettingsPanel({
  allowNegativeStock,
  canManage,
}: {
  allowNegativeStock: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(allowNegativeStock);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      await api.patch('/api/boutique/parametres/stock', { allowNegativeStock: allowed });
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
      <h2 className="text-sm font-medium">Stock</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Par défaut, la caisse refuse de vendre plus que le stock disponible.
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
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={allowed}
            onChange={(event) => setAllowed(event.target.checked)}
            disabled={!canManage}
            className="mt-1 accent-ink"
          />
          <span>
            Autoriser la vente à découvert
            <span className="mt-0.5 block text-xs text-ink-muted">
              La vente passe même si le stock enregistré ne suffit pas, et le stock devient
              négatif. À n&apos;activer que si votre stock réel est souvent en avance sur votre
              saisie — un stock négatif fausse la valeur de votre inventaire.
            </span>
          </span>
        </label>

        {canManage && (
          <Button type="submit" size="sm" loading={pending}>
            Enregistrer
          </Button>
        )}
      </form>
    </Card>
  );
}
