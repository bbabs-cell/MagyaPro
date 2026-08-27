'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  salesCount: number;
  totalSpent: number;
  creditBalance: number;
  creditLimit: number;
};

export function CustomersManager({
  initialCustomers,
  currency,
  canManage,
  canManageCredit,
}: {
  initialCustomers: Customer[];
  currency: string;
  canManage: boolean;
  canManageCredit: boolean;
}) {
  const router = useRouter();
  const [customers] = useState(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {canManage && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          + Nouveau client
        </Button>
      )}

      {showForm && (
        <CustomerForm
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          onDone={() => {
            setEditingCustomer(null);
            router.refresh();
          }}
          onCancel={() => setEditingCustomer(null)}
        />
      )}

      {customers.length === 0 ? (
        <EmptyState
          title="Aucun client pour le moment"
          description="Chaque vente associée à un client enrichit automatiquement sa fiche."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 text-right font-medium">Ventes</th>
                <th className="px-4 py-3 text-right font-medium">Total dépensé</th>
                <th className="px-4 py-3 text-right font-medium">Crédit</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-surface-border last:border-0">
                  <td data-label="Client" className="px-4 py-3">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-ink-faint">{customer.phone}</p>
                  </td>
                  <td data-label="Ventes" className="px-4 py-3 text-right">{customer.salesCount}</td>
                  <td data-label="Total dépensé" className="px-4 py-3 text-right">
                    {formatMoney(customer.totalSpent, currency)}
                  </td>
                  <td data-label="Crédit" className="px-4 py-3 text-right">
                    {customer.creditBalance > 0 ? (
                      <Badge tone="warning">{formatMoney(customer.creditBalance, currency)}</Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td data-label="" className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canManageCredit && customer.creditBalance > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPayingId(customer.id)}
                        >
                          Encaisser
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingCustomer(customer)}>
                          Modifier
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {payingId && (
        <CreditPaymentForm
          customer={customers.find((c) => c.id === payingId)!}
          currency={currency}
          onDone={() => {
            setPayingId(null);
            router.refresh();
          }}
          onCancel={() => setPayingId(null)}
        />
      )}
    </div>
  );
}

function CustomerForm({
  customer,
  onDone,
  onCancel,
}: {
  /** Présent pour une modification, absent pour une création. */
  customer?: Customer;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(customer);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: String(formData.get('email') ?? '') || undefined,
      address: String(formData.get('address') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
      creditLimit: Number(formData.get('creditLimit') ?? 0),
    };

    try {
      if (isEdit && customer) {
        await api.patch(`/api/boutique/customers/${customer.id}`, payload);
      } else {
        await api.post('/api/boutique/customers', payload);
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("L'enregistrement a échoué.");
      }
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">{isEdit ? `Modifier « ${customer!.name} »` : 'Nouveau client'}</h2>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}
        <Field label="Nom" htmlFor="customerName" required error={fieldErrors.name}>
          <input id="customerName" name="name" required className={inputClass} defaultValue={customer?.name} />
        </Field>
        <Field label="Téléphone" htmlFor="customerPhone" required error={fieldErrors.phone}>
          <input id="customerPhone" name="phone" required className={inputClass} defaultValue={customer?.phone} />
        </Field>
        <Field label="Email (facultatif)" htmlFor="customerEmail" error={fieldErrors.email}>
          <input id="customerEmail" name="email" type="email" className={inputClass} defaultValue={customer?.email ?? undefined} />
        </Field>
        <Field label="Adresse (facultatif)" htmlFor="customerAddress">
          <input id="customerAddress" name="address" className={inputClass} defaultValue={customer?.address ?? undefined} />
        </Field>
        <Field label="Notes (facultatif)" htmlFor="customerNotes">
          <textarea id="customerNotes" name="notes" rows={3} className={inputClass} defaultValue={customer?.notes ?? undefined} />
        </Field>
        <Field
          label="Limite de crédit"
          htmlFor="creditLimit"
          hint="0 = aucune vente à crédit autorisée pour ce client."
        >
          <input
            id="creditLimit"
            name="creditLimit"
            type="number"
            min={0}
            className={inputClass}
            defaultValue={customer?.creditLimit ?? 0}
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CreditPaymentForm({
  customer,
  currency,
  onDone,
  onCancel,
}: {
  customer: Customer;
  currency: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const maxAmount = toMajor(customer.creditBalance, currency);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await api.post(`/api/boutique/customers/${customer.id}/credit-payments`, {
        amount: toMinor(String(formData.get('amount') ?? '0'), currency),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'encaissement a échoué.");
      setPending(false);
    }
  }

  return (
    <Card className={cx('p-5', 'border-amber-200')}>
      <h2 className="text-lg font-medium">
        Encaisser un paiement — {customer.name}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Solde dû : {formatMoney(customer.creditBalance, currency)}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}
        <Field label={`Montant (${currency})`} htmlFor="amount" required>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            max={maxAmount}
            className={inputClass}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Enregistrer le paiement
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
