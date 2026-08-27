'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMinor } from '@/lib/money';
import { Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

type Supplier = { id: string; name: string; debtBalance: number };
type ProductOption = { variantId: string; name: string };
type Warehouse = { id: string; name: string; isDefault: boolean };
type PurchaseOrderItem = {
  id: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  discount: number;
};
type PurchaseOrder = {
  id: string;
  reference: string;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  extraFees: number;
  expectedAt: string | null;
  supplier: { id: string; name: string };
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

function orderTotal(order: PurchaseOrder): number {
  return (
    order.items.reduce((sum, item) => sum + (item.unitCost - item.discount) * item.quantityOrdered, 0) +
    order.extraFees
  );
}

export function PurchasesManager({
  initialSuppliers,
  initialProducts,
  initialOrders,
  warehouses,
  currency,
  canManage,
}: {
  initialSuppliers: Supplier[];
  initialProducts: ProductOption[];
  initialOrders: PurchaseOrder[];
  warehouses: Warehouse[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [suppliers] = useState(initialSuppliers);
  const [products] = useState(initialProducts);
  const [orders] = useState(initialOrders);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmOrder(orderId: string) {
    setPendingAction(orderId);
    setError(null);
    try {
      await api.post(`/api/boutique/purchase-orders/${orderId}/confirm`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La confirmation a échoué.');
    } finally {
      setPendingAction(null);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!window.confirm('Annuler cette commande ?')) return;
    setPendingAction(orderId);
    setError(null);
    try {
      await api.post(`/api/boutique/purchase-orders/${orderId}/cancel`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'annulation a échoué.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
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

      {payingSupplier && (
        <SupplierPaymentForm
          supplier={payingSupplier}
          orders={orders.filter((o) => o.supplier.id === payingSupplier.id)}
          currency={currency}
          onDone={() => {
            setPayingSupplier(null);
            router.refresh();
          }}
          onCancel={() => setPayingSupplier(null)}
        />
      )}

      {suppliers.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold text-ink">Fournisseurs</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{supplier.name}</span>
                <span className="flex items-center gap-3">
                  <span className={cx(supplier.debtBalance > 0 && 'font-medium text-state-warn')}>
                    {supplier.debtBalance > 0
                      ? `Dette : ${formatMoney(supplier.debtBalance, currency)}`
                      : 'Aucune dette'}
                  </span>
                  {canManage && supplier.debtBalance > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setPayingSupplier(supplier)}>
                      Enregistrer un paiement
                    </Button>
                  )}
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
                const total = orderTotal(order);
                const anyReceived = order.items.some((item) => item.quantityReceived > 0);
                return (
                  <tr key={order.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Commande" className="px-4 py-3 font-medium">
                      {order.reference}
                      {order.expectedAt && (
                        <span className="block text-xs font-normal text-ink-faint">
                          Attendue le {new Date(order.expectedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </td>
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
                      {canManage && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {order.status === 'DRAFT' && (
                            <>
                              <Button
                                size="sm"
                                loading={pendingAction === order.id}
                                onClick={() => confirmOrder(order.id)}
                              >
                                Confirmer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={pendingAction === order.id}
                                onClick={() => cancelOrder(order.id)}
                              >
                                Annuler
                              </Button>
                            </>
                          )}
                          {order.status === 'ORDERED' && !anyReceived && (
                            <Button size="sm" variant="ghost" loading={pendingAction === order.id} onClick={() => cancelOrder(order.id)}>
                              Annuler
                            </Button>
                          )}
                          {(order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && (
                            <Button size="sm" variant="secondary" onClick={() => setReceivingOrder(order)}>
                              Réceptionner
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {receivingOrder && (
        <ReceiveForm
          order={receivingOrder}
          warehouses={warehouses}
          onDone={() => {
            setReceivingOrder(null);
            router.refresh();
          }}
          onCancel={() => setReceivingOrder(null)}
        />
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
        {error && <p role="alert" className="w-full text-sm text-state-bad">{error}</p>}
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
  const [lines, setLines] = useState([{ productVariantId: '', quantity: 1, unitCost: '0', discount: '0' }]);

  function updateLine(index: number, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(confirm: boolean, formEl: HTMLFormElement) {
    setPending(true);
    setError(null);
    const formData = new FormData(formEl);

    try {
      await api.post('/api/boutique/purchase-orders', {
        supplierId: String(formData.get('supplierId') ?? ''),
        confirm,
        extraFees: toMinor(String(formData.get('extraFees') ?? '0'), currency),
        expectedAt: formData.get('expectedAt') ? String(formData.get('expectedAt')) : undefined,
        note: String(formData.get('note') ?? '') || undefined,
        items: lines
          .filter((line) => line.productVariantId)
          .map((line) => ({
            productVariantId: line.productVariantId,
            quantity: line.quantity,
            unitCost: toMinor(line.unitCost, currency),
            discount: toMinor(line.discount, currency),
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true, event.currentTarget);
        }}
        className="mt-5 space-y-4"
        noValidate
      >
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fournisseur" htmlFor="supplierId" required>
            <select id="supplierId" name="supplierId" required className={inputClass}>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Livraison attendue (facultatif)" htmlFor="expectedAt">
            <input id="expectedAt" name="expectedAt" type="date" className={inputClass} />
          </Field>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_90px_110px_110px_auto]">
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
                min={0.001}
                step={0.001}
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
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.discount}
                onChange={(event) => updateLine(index, { discount: event.target.value })}
                className={inputClass}
                placeholder="Remise/u."
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  className="text-ink-faint hover:text-state-bad"
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
            onClick={() => setLines((current) => [...current, { productVariantId: '', quantity: 1, unitCost: '0', discount: '0' }])}
          >
            + Ajouter une ligne
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Frais annexes (facultatif)" htmlFor="extraFees" hint="Transport, douane...">
            <input id="extraFees" name="extraFees" type="number" min={0} step="0.01" defaultValue="0" className={inputClass} />
          </Field>
          <Field label="Note (facultatif)" htmlFor="note">
            <input id="note" name="note" className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Commander
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={(event) => {
              const form = event.currentTarget.closest('form');
              if (form) void submit(false, form);
            }}
          >
            Enregistrer en brouillon
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReceiveForm({
  order,
  warehouses,
  onDone,
  onCancel,
}: {
  order: PurchaseOrder;
  warehouses: Warehouse[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const remainingItems = order.items.filter((item) => item.quantityReceived < item.quantityOrdered);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(remainingItems.map((item) => [item.id, item.quantityOrdered - item.quantityReceived])),
  );
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? '');
  const [expiryDate, setExpiryDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await api.post(`/api/boutique/purchase-orders/${order.id}/receive`, {
        warehouseId,
        expiryDate: expiryDate || undefined,
        items: remainingItems
          .map((item) => ({ purchaseOrderItemId: item.id, quantity: quantities[item.id] ?? 0 }))
          .filter((line) => line.quantity > 0),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La réception a échoué.');
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Réception — {order.reference}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ajustez les quantités si la livraison ne correspond pas exactement à la commande — le reste
        pourra être réceptionné plus tard.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entrepôt de réception" htmlFor="warehouseId" required>
            <select
              id="warehouseId"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              required
              className={inputClass}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date de péremption du lot (facultatif)" htmlFor="expiryDate" hint="Pour les denrées ou cosmétiques.">
            <input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="space-y-2">
          {remainingItems.map((item) => {
            const remaining = item.quantityOrdered - item.quantityReceived;
            return (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-surface-border p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{item.productName}</p>
                  <p className="text-xs text-ink-muted">
                    Commandé : {item.quantityOrdered} · Déjà reçu : {item.quantityReceived} · Reste : {remaining}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  step={0.001}
                  value={quantities[item.id] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                  }
                  className={cx(inputClass, 'w-28')}
                />
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending} disabled={!warehouseId}>
            Confirmer la réception
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SupplierPaymentForm({
  supplier,
  orders,
  currency,
  onDone,
  onCancel,
}: {
  supplier: Supplier;
  orders: PurchaseOrder[];
  currency: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await api.post(`/api/boutique/suppliers/${supplier.id}/payments`, {
        amount: toMinor(String(formData.get('amount') ?? '0'), currency),
        purchaseOrderId: String(formData.get('purchaseOrderId') ?? '') || undefined,
        note: String(formData.get('note') ?? '') || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Paiement — {supplier.name}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Dette actuelle : {formatMoney(supplier.debtBalance, currency)}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant" htmlFor="amount" required>
            <input id="amount" name="amount" type="number" min={0.01} step="0.01" required className={inputClass} />
          </Field>
          <Field label="Commande liée (facultatif)" htmlFor="purchaseOrderId">
            <select id="purchaseOrderId" name="purchaseOrderId" className={inputClass}>
              <option value="">Aucune — règlement global</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.reference}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Note (facultatif)" htmlFor="paymentNote">
          <input id="paymentNote" name="note" className={inputClass} />
        </Field>
        <div className="flex gap-2 pt-2">
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
