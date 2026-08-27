'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { Badge, Button, Card, Field, LinkButton, cx, inputClass } from '@/components/ui';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  card: 'Carte',
  wave: 'Wave',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Complétée',
  REFUNDED: 'Remboursée',
  PARTIALLY_REFUNDED: 'Partiellement remboursée',
  CANCELLED: 'Annulée',
};

type SaleItem = {
  productVariantId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
};

type Sale = {
  id: string;
  number: number;
  createdAt: string;
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
  total: number;
  items: SaleItem[];
  payments: Array<{ method: string }>;
  returnedByVariant: Record<string, number>;
};

export function SalesManager({ sales, currency }: { sales: Sale[]; currency: string }) {
  const router = useRouter();
  const [returning, setReturning] = useState<Sale | null>(null);
  const [resolution, setResolution] = useState<'REFUND' | 'EXCHANGE'>('REFUND');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startReturn(sale: Sale) {
    setReturning(sale);
    setResolution('REFUND');
    setQuantities({});
    setError(null);
  }

  function remainingFor(sale: Sale, item: SaleItem) {
    return item.quantity - (sale.returnedByVariant[item.productVariantId] ?? 0);
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returning) return;

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productVariantId, quantity]) => ({ productVariantId, quantity }));

    if (items.length === 0) {
      setError('Indiquez au moins une quantité à retourner.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get('reason') ?? '').trim() || undefined;

    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/returns', { saleId: returning.id, resolution, items, reason });
      setReturning(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le retour n'a pas pu être enregistré.");
    } finally {
      setPending(false);
    }
  }

  if (returning) {
    const returnableItems = returning.items.filter((item) => remainingFor(returning, item) > 0);

    return (
      <Card className="p-5">
        <h2 className="text-lg font-medium">Retour — vente n°{returning.number}</h2>

        <form onSubmit={submitReturn} className="mt-5 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
              {error}
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium">Articles à retourner</legend>
            <div className="mt-2 space-y-2">
              {returnableItems.map((item) => {
                const remaining = remainingFor(returning, item);
                return (
                  <div
                    key={item.productVariantId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.productName}</p>
                      <p className="text-xs text-ink-faint">
                        {formatMoney(item.unitPrice, currency)} · {remaining} disponible
                        {remaining > 1 ? 's' : ''} au retour
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      step={0.001}
                      value={quantities[item.productVariantId] ?? ''}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.productVariantId]: Math.min(
                            remaining,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        }))
                      }
                      className={cx(inputClass, 'w-20 text-right')}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <Field label="Résolution" htmlFor="resolution">
            <select
              id="resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value as 'REFUND' | 'EXCHANGE')}
              className={inputClass}
            >
              <option value="REFUND">Remboursement</option>
              <option value="EXCHANGE">Échange</option>
            </select>
          </Field>

          <Field label="Motif (facultatif)" htmlFor="reason">
            <input id="reason" name="reason" className={inputClass} />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={pending}>
              Confirmer le retour
            </Button>
            <Button type="button" variant="ghost" onClick={() => setReturning(null)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="table-stack w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">Vente</th>
            <th className="px-4 py-3 font-medium">Articles</th>
            <th className="px-4 py-3 font-medium">Paiement</th>
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const canReturn =
              sale.status !== 'CANCELLED' &&
              sale.items.some((item) => remainingFor(sale, item) > 0);
            return (
              <tr key={sale.id} className="border-b border-surface-border last:border-0">
                <td data-label="Vente" className="px-4 py-3">
                  <p className="font-medium">n°{sale.number}</p>
                  <p className="text-xs text-ink-faint">
                    {new Date(sale.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </td>
                <td data-label="Articles" className="px-4 py-3 text-ink-muted">
                  {sale.items.length} article{sale.items.length > 1 ? 's' : ''}
                </td>
                <td data-label="Paiement" className="px-4 py-3 text-ink-muted">
                  {sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join(', ')}
                </td>
                <td data-label="Statut" className="px-4 py-3">
                  <Badge tone={sale.status === 'COMPLETED' ? 'success' : 'neutral'}>
                    {STATUS_LABELS[sale.status]}
                  </Badge>
                </td>
                <td data-label="Total" className="px-4 py-3 text-right font-medium">
                  {formatMoney(sale.total, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <LinkButton
                      href={`/boutique/recu/${sale.id}`}
                      size="sm"
                      variant="secondary"
                      target="_blank"
                    >
                      Facture
                    </LinkButton>
                    {canReturn && (
                      <Button size="sm" variant="secondary" onClick={() => startReturn(sale)}>
                        Retourner
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
