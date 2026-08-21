'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMinor } from '@/lib/money';
import { Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

type Supplier = { id: string; name: string; debtBalance: number };
type ProductOption = { variantId: string; name: string };
type PurchaseOrderItem = { id: string; quantityOrdered: number; quantityReceived: number; unitCost: number };
type PurchaseOrder = {
  id: string;
  reference: string;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  supplier: { name: string };
  items: PurchaseOrderItem[];
};

const STATUS_LABELS: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'Brouillon',
  ORDERED: 'Commandée',
  PARTIALLY_RECEIVED: 'Partiellement reçue',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

const STATUS_TONES: Record<PurchaseOrder['status'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ORDERED: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

export function PurchasesManager({
  initialSuppliers,
  initialProducts,
  initialOrders,
  currency,
  canManage,
}: {
  initialSuppliers: Supplier[];
  initialProducts: ProductOption[];
  initialOrders: PurchaseOrder[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [suppliers] = useState(initialSuppliers);
  const [products] = useState(initialProducts);
  const [orders] = useState(initialOrders);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function receive(orderId: string) {
    setReceivingId(orderId);
    setError(null);
    try {
      await api.post(`/api/boutique/purchase-orders/${orderId}/receive`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La réception a échoué.");
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowOrderForm(true)} disabled={suppliers.length === 0}>
            + Nouvelle commande
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowSupplierForm(true)}>
            + Fournisseur
          </Button>
        </div>
      )}

      {suppliers.length === 0 && (
        <p className="text-sm text-ink-muted">
          Ajoutez d&apos;abord un fournisseur pour pouvoir créer une commande d&apos;achat.
        </p>
      )}

      {showSupplierForm && (
        <SupplierForm
          onDone={() => {
            setShowSupplierForm(false);
            router.refresh();
          }}
          onCancel={() => setShowSupplierForm(false)}
        />
      )}

      {showOrderForm && (
        <OrderForm
          suppliers={suppliers}
          products={products}
          currency={currency}
          onDone={() => {
            setShowOrderForm(false);
            router.refresh();
          }}
          onCancel={() => setShowOrderForm(false)}
        />
      )}

      {suppliers.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold text-ink">Fournisseurs</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex items-center justify-between py-2 text-sm">
                <span>{supplier.name}</span>
                <span className={cx(supplier.debtBalance > 0 && 'font-medium text-amber-700')}>
                  {supplier.debtBalance > 0
                    ? `Dette : ${formatMoney(supplier.debtBalance, currency)}`
                    : 'Aucune dette'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title="Aucune commande d'achat"
          description="Créez une commande pour réapprovisionner votre stock."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const total = order.items.reduce(
                  (sum, item) => sum + item.unitCost * item.quantityOrdered,
                  0,
                );
                return (
                  <tr key={order.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Commande" className="px-4 py-3 font-medium">{order.reference}</td>
                    <td data-label="Fournisseur" className="px-4 py-3 text-ink-muted">
                      {order.supplier.name}
                    </td>
                    <td data-label="Statut" className="px-4 py-3">
                      <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
                    </td>
                    <td data-label="Total" className="px-4 py-3 text-right font-medium">
                      {formatMoney(total, currency)}
                    </td>
                    <td data-label="" className="px-4 py-3 text-right">
                      {canManage && order.status === 'ORDERED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={receivingId === order.id}
                          onClick={() => receive(order.id)}
                        >
                          Réceptionner
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SupplierForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await api.post('/api/boutique/suppliers', {
        name: String(formData.get('name') ?? ''),
        phone: String(formData.get('phone') ?? '') || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
        <div className="min-w-48 flex-1">
          <Field label="Nom du fournisseur" htmlFor="supplierName">
            <input id="supplierName" name="name" required className={inputClass} placeholder="Grossiste Plateau" />
          </Field>
        </div>
        <div className="min-w-40 flex-1">
          <Field label="Téléphone" htmlFor="supplierPhone">
            <input id="supplierPhone" name="phone" className={inputClass} />
          </Field>
        </div>
        <Button type="submit" size="sm" loading={pending}>
          Ajouter
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </form>
    </Card>
  );
}

function OrderForm({
  suppliers,
  products,
  currency,
  onDone,
  onCancel,
}: {
  suppliers: Supplier[];
  products: ProductOption[];
  currency: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState([{ productVariantId: '', quantity: 1, unitCost: '0' }]);

  function updateLine(index: number, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await api.post('/api/boutique/purchase-orders', {
        supplierId: String(formData.get('supplierId') ?? ''),
        items: lines
          .filter((line) => line.productVariantId)
          .map((line) => ({
            productVariantId: line.productVariantId,
            quantity: line.quantity,
            unitCost: toMinor(line.unitCost, currency),
          })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Nouvelle commande d&apos;achat</h2>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Field label="Fournisseur" htmlFor="supplierId" required>
          <select id="supplierId" name="supplierId" required className={inputClass}>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
              <select
                value={line.productVariantId}
                onChange={(event) => updateLine(index, { productVariantId: event.target.value })}
                className={inputClass}
              >
                <option value="">Choisir un produit</option>
                {products.map((product) => (
                  <option key={product.variantId} value={product.variantId}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                className={inputClass}
                placeholder="Qté"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitCost}
                onChange={(event) => updateLine(index, { unitCost: event.target.value })}
                className={inputClass}
                placeholder={`Coût (${currency})`}
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  className="text-ink-faint hover:text-red-600"
                  aria-label="Retirer cette ligne"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLines((current) => [...current, { productVariantId: '', quantity: 1, unitCost: '0' }])}
          >
            + Ajouter une ligne
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Créer la commande
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
