'use client';

import { useState, type FormEvent } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMinor } from '@/lib/money';
import { AlertMessage, Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  incurredAt: string;
  notes: string | null;
};

const CATEGORIES = [
  { value: 'INGREDIENTS', label: 'Ingrédients' },
  { value: 'STAFF', label: 'Personnel' },
  { value: 'RENT', label: 'Loyer' },
  { value: 'UTILITIES', label: 'Charges' },
  { value: 'OTHER', label: 'Autre' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export function ExpensesManager({
  expenses,
  currency,
}: {
  expenses: Expense[];
  currency: string;
}) {
  const [creating, setCreating] = useState(false);
  const mutation = useServerMutation();
  const fieldErrors = mutation.fieldErrors;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      label: String(formData.get('label') ?? ''),
      amount: toMinor(String(formData.get('amount') ?? '0'), currency),
      category: String(formData.get('category') ?? 'OTHER'),
      incurredAt: new Date(String(formData.get('incurredAt') ?? '')).toISOString(),
      notes: String(formData.get('notes') ?? ''),
    };

    mutation.run(() => api.post('/api/depenses', payload), {
      key: 'creation',
      onSuccess: () => setCreating(false),
      successMessage: 'Dépense enregistrée.',
      failureMessage: "La dépense n'a pas pu être enregistrée.",
    });
  }

  function remove(expense: Expense) {
    if (!window.confirm(`Supprimer « ${expense.label} » ?`)) return;
    mutation.run(() => api.delete(`/api/depenses/${expense.id}`), {
      key: expense.id,
      successMessage: 'Dépense supprimée.',
      failureMessage: "La dépense n'a pas pu être supprimée.",
    });
  }

  return (
    <>
      <AlertMessage message={mutation.error} className="mb-4" />

      {creating && (
        <Card className="mb-6 p-5">
          <h2 className="text-lg font-medium">Nouvelle dépense</h2>
          <form onSubmit={create} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Libellé" htmlFor="label" required error={fieldErrors.label}>
                <input id="label" name="label" required className={inputClass} placeholder="Achat légumes" />
              </Field>
              <Field label={`Montant (${currency})`} htmlFor="amount" required error={fieldErrors.amount}>
                <input id="amount" name="amount" type="number" min="0" step="any" required className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Catégorie" htmlFor="category" required>
                <select id="category" name="category" className={inputClass} defaultValue="OTHER">
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" htmlFor="incurredAt" required error={fieldErrors.incurredAt}>
                <input
                  id="incurredAt"
                  name="incurredAt"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Notes" htmlFor="notes" hint="Facultatif" error={fieldErrors.notes}>
              <input id="notes" name="notes" className={inputClass} />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={mutation.isPending('creation')}>
                Enregistrer
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Dépenses</h2>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              Nouvelle dépense
            </Button>
          )}
        </div>

        {expenses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aucune dépense enregistrée"
              description="Enregistrez vos dépenses pour connaître votre résultat net, pas seulement votre chiffre d'affaires."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  Ajouter une dépense
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-surface-border">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{expense.label}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {CATEGORY_LABEL[expense.category] ?? expense.category} ·{' '}
                    {new Date(expense.incurredAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium">{formatMoney(expense.amount, currency)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={mutation.isPending(expense.id)}
                    disabled={mutation.pending}
                    onClick={() => remove(expense)}
                  >
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
