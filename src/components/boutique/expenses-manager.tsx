'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Loyer',
  UTILITIES: 'Charges (eau, électricité...)',
  STAFF: 'Personnel',
  TRANSPORT: 'Transport',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Entretien',
  SUPPLIES: 'Fournitures',
  OTHER: 'Autre',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  incurredAt: string;
  notes: string | null;
};

export function ExpensesManager({
  initialExpenses,
  currency,
  canManage,
}: {
  initialExpenses: Expense[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [expenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pending, setPending] = useState(false);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  async function remove(expense: Expense) {
    if (!window.confirm(`Supprimer la dépense « ${expense.label} » ?`)) return;
    setPending(true);
    try {
      await api.delete(`/api/boutique/expenses/${expense.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          + Nouvelle dépense
        </Button>
      )}

      {(showForm || editing) && (
        <ExpenseForm
          currency={currency}
          expense={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {expenses.length === 0 ? (
        <EmptyState
          title="Aucune dépense enregistrée"
          description="Loyer, charges, fournitures... suivez ici tout ce qui sort de la caisse en dehors des achats de stock."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Dépense</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-surface-border last:border-0">
                  <td data-label="Dépense" className="px-4 py-3">
                    <p className="font-medium">{expense.label}</p>
                    {expense.notes && <p className="text-xs text-ink-faint">{expense.notes}</p>}
                  </td>
                  <td data-label="Catégorie" className="px-4 py-3 text-ink-muted">
                    {CATEGORY_LABELS[expense.category] ?? expense.category}
                  </td>
                  <td data-label="Date" className="px-4 py-3 text-ink-muted">
                    {new Date(expense.incurredAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td data-label="Montant" className="px-4 py-3 text-right font-medium">
                    {formatMoney(expense.amount, currency)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(expense)}>
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => remove(expense)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-border font-medium">
                <td colSpan={3} className="px-4 py-3 text-right text-ink-muted">
                  Total
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(total, currency)}</td>
                {canManage && <td />}
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}

function ExpenseForm({
  currency,
  expense,
  onDone,
  onCancel,
}: {
  currency: string;
  expense: Expense | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      label: String(formData.get('label') ?? ''),
      amount: toMinor(String(formData.get('amount') ?? '0'), currency),
      category: String(formData.get('category') ?? 'OTHER'),
      incurredAt: String(formData.get('incurredAt') ?? ''),
      notes: String(formData.get('notes') ?? '') || undefined,
    };

    try {
      if (expense) {
        await api.patch(`/api/boutique/expenses/${expense.id}`, payload);
      } else {
        await api.post('/api/boutique/expenses', payload);
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La dépense n'a pas pu être enregistrée.");
      }
    } finally {
      setPending(false);
    }
  }

  const defaultDate = expense
    ? new Date(expense.incurredAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">{expense ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        <Field label="Libellé" htmlFor="label" required error={fieldErrors.label}>
          <input
            id="label"
            name="label"
            required
            defaultValue={expense?.label}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Montant (${currency})`} htmlFor="amount" required error={fieldErrors.amount}>
            <input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={expense ? toMajor(expense.amount, currency) : undefined}
              className={inputClass}
            />
          </Field>

          <Field label="Date" htmlFor="incurredAt" required>
            <input
              id="incurredAt"
              name="incurredAt"
              type="date"
              required
              defaultValue={defaultDate}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Catégorie" htmlFor="category">
          <select id="category" name="category" defaultValue={expense?.category ?? 'OTHER'} className={inputClass}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes (facultatif)" htmlFor="notes">
          <input id="notes" name="notes" defaultValue={expense?.notes ?? ''} className={cx(inputClass)} />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
