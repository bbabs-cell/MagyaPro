'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMinor } from '@/lib/money';
import { Badge, Button, Card, Field, cx, inputClass } from '@/components/ui';

type Session = {
  id: string;
  openingBalance: number;
  cashRegister: { name: string };
  movements: Array<{ type: 'SALE' | 'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE'; amount: number }>;
  sales: Array<{ payments: Array<{ method: string; amount: number }> }>;
} | null;

export function CashSessionBar({ session, currency }: { session: Session; currency: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'open' | 'close' | 'movement'>('idle');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await api.post('/api/boutique/cash-sessions', {
        openingBalance: toMinor(String(formData.get('openingBalance') ?? '0'), currency),
      });
      setMode('idle');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'ouverture a échoué.");
    } finally {
      setPending(false);
    }
  }

  async function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      const { session: closed } = await api.post<{
        session: { expectedBalance: number; countedBalance: number; difference: number };
      }>(`/api/boutique/cash-sessions/${session.id}/close`, {
        countedBalance: toMinor(String(formData.get('countedBalance') ?? '0'), currency),
      });
      setMode('idle');
      router.refresh();
      const sign = closed.difference > 0 ? '+' : '';
      window.alert(
        `Caisse fermée. Écart : ${sign}${formatMoney(closed.difference, currency)}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La fermeture a échoué.');
    } finally {
      setPending(false);
    }
  }

  async function recordMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await api.post(`/api/boutique/cash-sessions/${session.id}/movements`, {
        type: String(formData.get('type') ?? 'DEPOSIT'),
        amount: toMinor(String(formData.get('amount') ?? '0'), currency),
        reason: String(formData.get('reason') ?? '') || undefined,
      });
      setMode('idle');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    return (
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-medium text-ink">Caisse fermée</p>
          <p className="text-sm text-ink-muted">Ouvrez une session pour commencer à encaisser.</p>
        </div>
        {mode === 'open' ? (
          <form onSubmit={openSession} className="flex flex-wrap items-end gap-2">
            {error && <p role="alert" className="w-full text-sm text-state-bad">{error}</p>}
            <Field label={`Fond de caisse initial (${currency})`} htmlFor="openingBalance">
              <input
                id="openingBalance"
                name="openingBalance"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue="0"
                className={cx(inputClass, 'w-40')}
              />
            </Field>
            <Button type="submit" size="sm" loading={pending}>
              Ouvrir
            </Button>
          </form>
        ) : (
          <Button size="sm" onClick={() => setMode('open')}>
            Ouvrir la caisse
          </Button>
        )}
      </Card>
    );
  }

  const cashSales = session.sales.reduce(
    (sum, sale) => sum + sale.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
    0,
  );
  const deposits = session.movements.filter((m) => m.type === 'DEPOSIT').reduce((s, m) => s + m.amount, 0);
  const withdrawals = session.movements
    .filter((m) => m.type === 'WITHDRAWAL' || m.type === 'EXPENSE')
    .reduce((s, m) => s + m.amount, 0);
  const expected = session.openingBalance + cashSales + deposits - withdrawals;

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink">{session.cashRegister.name}</p>
            <Badge tone="success">Ouverte</Badge>
          </div>
          <p className="text-sm text-ink-muted">
            Solde théorique en espèces : {formatMoney(expected, currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMode('movement')}>
            Dépôt / Retrait
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('close')}>
            Fermer la caisse
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-state-bad">
          {error}
        </p>
      )}

      {mode === 'movement' && (
        <form onSubmit={recordMovement} className="mt-4 flex flex-wrap items-end gap-2 border-t border-surface-border pt-4">
          <Field label="Type" htmlFor="type">
            <select id="type" name="type" className={inputClass}>
              <option value="DEPOSIT">Dépôt</option>
              <option value="WITHDRAWAL">Retrait</option>
            </select>
          </Field>
          <Field label={`Montant (${currency})`} htmlFor="movementAmount">
            <input
              id="movementAmount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              className={cx(inputClass, 'w-32')}
            />
          </Field>
          <Field label="Motif (facultatif)" htmlFor="reason">
            <input id="reason" name="reason" className={inputClass} />
          </Field>
          <Button type="submit" size="sm" loading={pending}>
            Enregistrer
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode('idle')}>
            Annuler
          </Button>
        </form>
      )}

      {mode === 'close' && (
        <form onSubmit={closeSession} className="mt-4 flex flex-wrap items-end gap-2 border-t border-surface-border pt-4">
          <Field
            label={`Montant compté en caisse (${currency})`}
            htmlFor="countedBalance"
            hint={`Théorique : ${formatMoney(expected, currency)}`}
          >
            <input
              id="countedBalance"
              name="countedBalance"
              type="number"
              min={0}
              step="0.01"
              required
              className={cx(inputClass, 'w-40')}
            />
          </Field>
          <Button type="submit" size="sm" variant="danger" loading={pending}>
            Confirmer la fermeture
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode('idle')}>
            Annuler
          </Button>
        </form>
      )}
    </Card>
  );
}
