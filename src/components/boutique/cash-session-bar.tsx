'use client';

import { useState, type FormEvent } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMinor } from '@/lib/money';
import { AlertMessage, Badge, Button, Card, Field, cx, inputClass } from '@/components/ui';

type Session = {
  id: string;
  openingBalance: number;
  cashRegister: { name: string };
  movements: Array<{ type: 'SALE' | 'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE'; amount: number }>;
  sales: Array<{ payments: Array<{ method: string; amount: number }> }>;
} | null;

export function CashSessionBar({ session, currency }: { session: Session; currency: string }) {
  const [mode, setMode] = useState<'idle' | 'open' | 'close' | 'movement'>('idle');
  /**
   * Écart constaté à la dernière fermeture.
   *
   * Il s'affichait auparavant dans un `window.alert`. Deux défauts : la boîte
   * native fige la page — le rafraîchissement lancé juste avant restait
   * suspendu tant que le caissier n'avait pas appuyé sur « OK » — et son
   * contenu disparaissait définitivement à la fermeture. Or un écart de caisse
   * est précisément le chiffre qu'on veut relire, noter, montrer au patron.
   */
  const [closingReport, setClosingReport] = useState<string | null>(null);
  const mutation = useServerMutation();
  const pending = mutation.pending;

  function openSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    mutation.run(
      () =>
        api.post('/api/boutique/cash-sessions', {
          openingBalance: toMinor(String(formData.get('openingBalance') ?? '0'), currency),
        }),
      { onSuccess: () => setMode('idle'), failureMessage: "L'ouverture a échoué." },
    );
  }

  function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    mutation.run(
      () =>
        api.post<{
          session: { expectedBalance: number; countedBalance: number; difference: number };
        }>(`/api/boutique/cash-sessions/${session.id}/close`, {
          countedBalance: toMinor(String(formData.get('countedBalance') ?? '0'), currency),
        }),
      {
        failureMessage: 'La fermeture a échoué.',
        onSuccess: ({ session: closed }) => {
          setMode('idle');
          const sign = closed.difference > 0 ? '+' : '';
          setClosingReport(
            closed.difference === 0
              ? `Caisse fermée. Le compte est juste : ${formatMoney(closed.countedBalance, currency)}.`
              : `Caisse fermée. Compté ${formatMoney(closed.countedBalance, currency)} pour ${formatMoney(closed.expectedBalance, currency)} attendus — écart de ${sign}${formatMoney(closed.difference, currency)}.`,
          );
        },
      },
    );
  }

  function recordMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    mutation.run(
      () =>
        api.post(`/api/boutique/cash-sessions/${session.id}/movements`, {
          type: String(formData.get('type') ?? 'DEPOSIT'),
          amount: toMinor(String(formData.get('amount') ?? '0'), currency),
          reason: String(formData.get('reason') ?? '') || undefined,
        }),
      { onSuccess: () => setMode('idle'), failureMessage: "L'enregistrement a échoué." },
    );
  }

  if (!session) {
    return (
      <Card className="mb-6 p-4">
        {/* Le relevé de la fermeture qui vient d'avoir lieu, affiché tant que
            le caissier ne l'a pas écarté — il n'y a pas d'autre endroit dans
            l'écran où relire l'écart constaté. */}
        {closingReport && (
          <div
            role="status"
            className="mb-3 flex items-start gap-3 rounded-xl border border-surface-border bg-surface-sunken px-4 py-3 text-sm text-ink"
          >
            <p className="min-w-0 flex-1">{closingReport}</p>
            <button
              type="button"
              onClick={() => setClosingReport(null)}
              className="shrink-0 text-ink-faint hover:text-ink"
              aria-label="Masquer le relevé de fermeture"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Caisse fermée</p>
          <p className="text-sm text-ink-muted">Ouvrez une session pour commencer à encaisser.</p>
        </div>
        {mode === 'open' ? (
          <form onSubmit={openSession} className="flex flex-wrap items-end gap-2">
            <AlertMessage message={mutation.error} className="w-full" />
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
        </div>
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

      <AlertMessage message={mutation.error} className="mt-3" />

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
