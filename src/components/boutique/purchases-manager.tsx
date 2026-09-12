'use client';

import { useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMinor } from '@/lib/money';
import { AlertMessage, Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TONES } from '@/lib/boutique/labels';
import {
  PURCHASE_PAYMENT_LABELS,
  PURCHASE_PAYMENT_TONES,
  type PurchaseBalance,
} from '@/lib/boutique/purchase-payment';

/** `outstanding` : reste dû, déduit des commandes livrées — plus un compteur. */
type Supplier = { id: string; name: string; outstanding: number };
type ProductOption = { variantId: string; name: string };
type Warehouse = { id: string; name: string; isDefault: boolean };
type PurchaseOrderItem = {
  id: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitFactor: number;
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
  /** Livré, réglé, reste — calculé côté serveur, jamais stocké. */
  payment: PurchaseBalance;
  items: PurchaseOrderItem[];
};

/** Une commande encore attendue dont la date d'arrivée est passée. */
function isLate(order: PurchaseOrder, today: string): boolean {
  if (order.status !== 'ORDERED' && order.status !== 'PARTIALLY_RECEIVED') return false;
  if (!order.expectedAt) return false;
  // Comparaison de chaînes AAAA-MM-JJ : pas de fuseau horaire dans l'affaire,
  // donc pas de commande qui bascule en retard selon l'heure de consultation.
  return order.expectedAt.slice(0, 10) < today;
}

/**
 * Les commandes à suivre d'abord, les closes ensuite, chaque groupe du plus
 * récent au plus ancien. Une livraison en retard n'a rien à faire sous trois
 * commandes déjà réceptionnées.
 */
const OPEN_STATUSES: Array<PurchaseOrder['status']> = ['ORDERED', 'PARTIALLY_RECEIVED', 'DRAFT'];

function sortOrders(orders: PurchaseOrder[], today: string): PurchaseOrder[] {
  const rank = (order: PurchaseOrder) => {
    if (isLate(order, today)) return 0;
    const open = OPEN_STATUSES.indexOf(order.status);
    return open === -1 ? 2 : 1;
  };
  return [...orders].sort((a, b) => rank(a) - rank(b));
}

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
  today,
}: {
  initialSuppliers: Supplier[];
  initialProducts: ProductOption[];
  initialOrders: PurchaseOrder[];
  /** Date du jour figée par le serveur, au format AAAA-MM-JJ. */
  today: string;
  warehouses: Warehouse[];
  currency: string;
  canManage: boolean;
}) {
  /**
   * Données du serveur, lues telles quelles.
   *
   * Elles étaient auparavant recopiées dans un `useState` sans jamais être
   * remises à jour. Or `useState` ignore sa valeur initiale à tous les rendus
   * suivants : la liste restait figée sur son contenu du premier affichage.
   * Chaque `router.refresh()` de cet écran renvoyait donc des données
   * fraîches que rien ne montrait — un produit créé, un prix corrigé, une
   * ligne supprimée n'apparaissaient qu'après un rechargement complet de la
   * page.
   */
  const suppliers = initialSuppliers;
  const products = initialProducts;
  const orders = initialOrders;
  const sortedOrders = sortOrders(orders, today);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  /**
   * Commande en cours de réception, retenue par son identifiant et non par
   * l'objet lui-même.
   *
   * L'écran de réception affiche maintenant l'état du règlement, qui change
   * pendant qu'il est ouvert. Garder une copie de la commande la figerait au
   * moment de l'ouverture : le commerçant réceptionnerait, paierait, et lirait
   * encore les chiffres d'avant.
   */
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const receivingOrder = receivingId ? (orders.find((o) => o.id === receivingId) ?? null) : null;
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const mutation = useServerMutation();

  function confirmOrder(orderId: string) {
    mutation.run(() => api.post(`/api/boutique/purchase-orders/${orderId}/confirm`), {
      key: `${orderId}:confirm`,
      successMessage: 'Commande envoyée au fournisseur.',
      failureMessage: 'La confirmation a échoué.',
    });
  }

  function cancelOrder(orderId: string) {
    if (!window.confirm('Annuler cette commande ?')) return;
    mutation.run(() => api.post(`/api/boutique/purchase-orders/${orderId}/cancel`), {
      key: `${orderId}:cancel`,
      successMessage: 'Commande annulée.',
      failureMessage: "L'annulation a échoué.",
    });
  }

  return (
    <div className="space-y-6">
      <AlertMessage message={mutation.error} />

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
          onDone={() => mutation.settled('Fournisseur ajouté.', () => setShowSupplierForm(false))}
          onCancel={() => setShowSupplierForm(false)}
        />
      )}

      {showOrderForm && (
        <OrderForm
          suppliers={suppliers}
          products={products}
          currency={currency}
          onDone={() => mutation.settled('Commande enregistrée.', () => setShowOrderForm(false))}
          onCancel={() => setShowOrderForm(false)}
        />
      )}

      {payingSupplier && (
        <SupplierPaymentForm
          supplier={payingSupplier}
          orders={orders.filter((o) => o.supplier.id === payingSupplier.id)}
          currency={currency}
          onDone={() => mutation.settled('Paiement enregistré.', () => setPayingSupplier(null))}
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
                  <span className={cx(supplier.outstanding > 0 && 'font-medium text-state-warn')}>
                    {supplier.outstanding > 0
                      ? `Reste à régler : ${formatMoney(supplier.outstanding, currency)}`
                      : 'À jour'}
                  </span>
                  {canManage && supplier.outstanding > 0 && (
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
          {/* Les commandes à suivre d'abord, les closes ensuite. Mélangées par
              ordre de création, une livraison en retard se retrouvait sous
              trois commandes déjà reçues dont plus personne n'a rien à faire. */}
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => {
                const total = orderTotal(order);
                const anyReceived = order.items.some((item) => item.quantityReceived > 0);
                const late = isLate(order, today);
                return (
                  <tr key={order.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Commande" className="px-4 py-3 font-medium">
                      {order.reference}
                      {order.expectedAt && (
                        <span
                          className={cx(
                            'block text-xs font-normal',
                            // Une date d'arrivée dépassée est la seule
                            // information vraiment actionnable de cet écran :
                            // elle était affichée du même gris que le reste.
                            late ? 'font-medium text-state-bad' : 'text-ink-faint',
                          )}
                        >
                          {late ? 'En retard depuis le ' : 'Attendue le '}
                          {new Date(order.expectedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </td>
                    <td data-label="Fournisseur" className="px-4 py-3 text-ink-muted">
                      {order.supplier.name}
                    </td>
                    <td data-label="Statut" className="px-4 py-3">
                      <Badge tone={PURCHASE_STATUS_TONES[order.status]}>
                        {PURCHASE_STATUS_LABELS[order.status]}
                      </Badge>
                      {/* Livraison et règlement sont deux questions distinctes.
                          Elles se lisaient auparavant dans un compteur unique,
                          chez le fournisseur, où l'on ne pouvait plus dire
                          quelle commande restait à payer. */}
                      {order.payment.due > 0 && (
                        <span className="mt-1 block">
                          <Badge tone={PURCHASE_PAYMENT_TONES[order.payment.state]}>
                            {PURCHASE_PAYMENT_LABELS[order.payment.state]}
                          </Badge>
                          {order.payment.remaining > 0 && (
                            <span className="mt-0.5 block text-xs text-ink-muted">
                              Reste {formatMoney(order.payment.remaining, currency)}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td data-label="Total" className="px-4 py-3 text-right font-medium">
                      {formatMoney(total, currency)}
                    </td>
                    <td data-label="Actions" className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {order.status === 'DRAFT' && (
                            <>
                              {/* Chaque bouton porte sa propre clé : les deux
                                  tournaient auparavant ensemble, et rien ne
                                  disait laquelle des deux actions était
                                  partie. */}
                              <Button
                                size="sm"
                                loading={mutation.isPending(`${order.id}:confirm`)}
                                disabled={mutation.pending}
                                onClick={() => confirmOrder(order.id)}
                              >
                                Confirmer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={mutation.isPending(`${order.id}:cancel`)}
                                disabled={mutation.pending}
                                onClick={() => cancelOrder(order.id)}
                              >
                                Annuler
                              </Button>
                            </>
                          )}
                          {order.status === 'ORDERED' && !anyReceived && (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={mutation.isPending(`${order.id}:cancel`)}
                              disabled={mutation.pending}
                              onClick={() => cancelOrder(order.id)}
                            >
                              Annuler
                            </Button>
                          )}
                          {(order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && (
                            <Button size="sm" variant="secondary" onClick={() => setReceivingId(order.id)}>
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
          currency={currency}
          // La réception ne referme plus l'écran : le règlement se fait juste
          // en dessous, avec le reste à payer que le serveur vient de
          // recalculer. Refermer obligerait à ressortir, retrouver la
          // commande, rouvrir un formulaire de paiement — ce que le §14
          // proscrit explicitement.
          onReceived={() => mutation.settled('Réception enregistrée, stock mis à jour.')}
          onPaid={() => mutation.settled('Paiement enregistré.')}
          onClose={() => setReceivingId(null)}
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
  // Les frais annexes deviennent un état plutôt qu'un champ libre : ils
  // entrent dans le total affiché, et un total qui ignore le transport n'est
  // pas le total.
  const [extraFees, setExtraFees] = useState('0');

  /**
   * Total de la commande, mis à jour à chaque frappe.
   *
   * Le formulaire affichait le total de chaque ligne mais jamais celui de la
   * commande : sur cinq lignes, le commerçant validait sans savoir ce qu'il
   * engageait, et devait attendre la liste pour le découvrir. Le §13 demande
   * de voir le total avant de valider.
   */
  const linesTotal = lines.reduce((sum, line) => {
    const unitCost = Number(line.unitCost.replace(',', '.')) || 0;
    const discount = Number(line.discount.replace(',', '.')) || 0;
    return sum + Math.max(0, unitCost - discount) * (line.quantity || 0);
  }, 0);
  const feesValue = Number(extraFees.replace(',', '.')) || 0;
  const filledLines = lines.filter((line) => line.productVariantId).length;

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
        extraFees: toMinor(extraFees || '0', currency),
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
          {/* En-têtes de colonnes, sur grand écran seulement.
              Les champs n'avaient pour toute étiquette qu'un texte d'invite,
              qui disparaît dès la première frappe : une fois la ligne
              remplie, on lisait « 12 · 4500 · 200 » sans savoir lequel était
              la quantité et lequel le prix. Sur téléphone, où les champs
              s'empilent, c'était pire encore. */}
          <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid sm:grid-cols-[1fr_90px_120px_120px_110px_auto]">
            <span>Produit</span>
            <span>Quantité</span>
            <span>Coût unitaire</span>
            <span>Remise / unité</span>
            <span className="text-end">Total ligne</span>
            <span className="sr-only">Retirer</span>
          </div>

          {lines.map((line, index) => {
            const quantity = Number(line.quantity) || 0;
            const unitCost = Number(String(line.unitCost).replace(',', '.')) || 0;
            const discount = Number(String(line.discount).replace(',', '.')) || 0;
            // Total de la ligne, affiché en clair : c'est le seul moyen de
            // vérifier d'un coup d'œil qu'on n'a pas interverti la quantité
            // et le prix — 4500 articles à 12 F saute alors aux yeux.
            const lineTotal = Math.max(0, unitCost - discount) * quantity;

            return (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-surface-border p-3 sm:grid-cols-[1fr_90px_120px_120px_110px_auto] sm:items-center sm:border-0 sm:p-0"
              >
                <label className="sm:contents">
                  <span className="mb-1 block text-xs font-medium text-ink-muted sm:hidden">
                    Produit
                  </span>
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
                </label>

                <label className="sm:contents">
                  <span className="mb-1 block text-xs font-medium text-ink-muted sm:hidden">
                    Quantité
                  </span>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                    className={inputClass}
                  />
                </label>

                <label className="sm:contents">
                  <span className="mb-1 block text-xs font-medium text-ink-muted sm:hidden">
                    Coût unitaire ({currency})
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) => updateLine(index, { unitCost: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="sm:contents">
                  <span className="mb-1 block text-xs font-medium text-ink-muted sm:hidden">
                    Remise par unité ({currency})
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.discount}
                    onChange={(event) => updateLine(index, { discount: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <p className="flex items-baseline justify-between gap-2 text-sm tabular-nums sm:justify-end">
                  <span className="text-xs font-medium text-ink-muted sm:hidden">Total ligne</span>
                  <span className={lineTotal > 0 ? 'font-semibold text-ink' : 'text-ink-faint'}>
                    {formatMoney(toMinor(String(lineTotal), currency), currency)}
                  </span>
                </p>

                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    className="justify-self-end text-sm text-ink-faint hover:text-state-bad sm:justify-self-auto"
                  >
                    <span className="sm:hidden">Retirer cette ligne</span>
                    <span aria-hidden="true" className="hidden sm:inline">
                      ✕
                    </span>
                    <span className="sr-only hidden sm:inline">Retirer cette ligne</span>
                  </button>
                )}
              </div>
            );
          })}
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
            <input
              id="extraFees"
              inputMode="decimal"
              value={extraFees}
              onChange={(event) => setExtraFees(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Note (facultatif)" htmlFor="note">
            <input id="note" name="note" className={inputClass} />
          </Field>
        </div>

        {/* Récapitulatif : ce qu'on engage, juste au-dessus du bouton qui
            l'engage. */}
        <div className="rounded-xl border border-surface-border bg-surface-sunken p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">
                {filledLines} produit{filledLines > 1 ? 's' : ''}
              </dt>
              <dd>{formatMoney(toMinor(String(linesTotal), currency), currency)}</dd>
            </div>
            {feesValue > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Frais annexes</dt>
                <dd>{formatMoney(toMinor(String(feesValue), currency), currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-border pt-1.5 text-base font-semibold text-ink">
              <dt>Total de la commande</dt>
              <dd>{formatMoney(toMinor(String(linesTotal + feesValue), currency), currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" loading={pending} disabled={filledLines === 0}>
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

/**
 * Réception d'une commande fournisseur — et son règlement, au même endroit.
 *
 * Le §14 est explicite : réceptionner ne doit pas obliger à sortir, chercher la
 * facture ailleurs, ouvrir un autre écran de paiement, puis revenir vérifier.
 * C'était pourtant le parcours : la réception fermait l'écran, et le règlement
 * se faisait depuis la fiche du fournisseur, en retrouvant la commande dans une
 * liste déroulante.
 *
 * Ici, l'argent est affiché en haut — livré, réglé, reste — et le formulaire de
 * règlement est en bas, sur la même page. Confirmer une réception ne referme
 * plus rien : les montants se recalculent et le versement peut suivre
 * immédiatement, pendant que le livreur du fournisseur attend.
 */
function ReceiveForm({
  order,
  warehouses,
  currency,
  onReceived,
  onPaid,
  onClose,
}: {
  order: PurchaseOrder;
  warehouses: Warehouse[];
  currency: string;
  onReceived: () => void;
  onPaid: () => void;
  onClose: () => void;
}) {
  const remainingItems = order.items.filter((item) => item.quantityReceived < item.quantityOrdered);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? '',
  );
  const [expiryDate, setExpiryDate] = useState('');
  const mutation = useServerMutation();

  // Les quantités proposées suivent la commande : après une réception
  // partielle, le reste attendu change, et une valeur figée à l'ouverture
  // proposerait de réceptionner deux fois la même marchandise.
  const suggested = (item: PurchaseOrderItem) =>
    quantities[item.id] ?? item.quantityOrdered - item.quantityReceived;

  const ordered = orderTotal(order);
  const fullyReceived = remainingItems.length === 0;

  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = remainingItems
      .map((item) => ({ purchaseOrderItemId: item.id, quantity: suggested(item) }))
      .filter((line) => line.quantity > 0);

    mutation.run(
      () =>
        api.post(`/api/boutique/purchase-orders/${order.id}/receive`, {
          warehouseId,
          expiryDate: expiryDate || undefined,
          items: lines,
        }),
      {
        key: 'reception',
        onSuccess: () => {
          setQuantities({});
          onReceived();
        },
        failureMessage: 'La réception a échoué.',
      },
    );
  }

  function pay(amount: number, note?: string) {
    mutation.run(
      () =>
        api.post(`/api/boutique/suppliers/${order.supplier.id}/payments`, {
          amount,
          purchaseOrderId: order.id,
          note: note || undefined,
        }),
      {
        key: 'paiement',
        onSuccess: onPaid,
        failureMessage: "Le paiement n'a pas pu être enregistré.",
      },
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Réception — {order.reference}</h2>
          <p className="mt-1 text-sm text-ink-muted">{order.supplier.name}</p>
        </div>
        <Badge tone={PURCHASE_PAYMENT_TONES[order.payment.state]}>
          {PURCHASE_PAYMENT_LABELS[order.payment.state]}
        </Badge>
      </div>

      <AlertMessage message={mutation.error} className="mt-4" />

      {/* ------------------------------------------------------- L'argent */}
      <dl className="mt-4 grid gap-3 rounded-xl border border-surface-border bg-surface-sunken p-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-muted">Commandé</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatMoney(ordered, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Livré à ce jour</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatMoney(order.payment.due, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Déjà réglé</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatMoney(order.payment.paid, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Reste à payer</dt>
          <dd
            className={cx(
              'mt-0.5 text-lg font-semibold',
              order.payment.remaining > 0 ? 'text-state-warn' : 'text-state-ok',
            )}
          >
            {formatMoney(order.payment.remaining, currency)}
          </dd>
        </div>
      </dl>

      {order.payment.advance > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Vous avez versé {formatMoney(order.payment.advance, currency)} de plus que ce qui est
          livré — une avance sur le reste de la commande.
        </p>
      )}

      {/* --------------------------------------------------- La réception */}
      {fullyReceived ? (
        <p className="mt-5 rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-muted">
          Toute la marchandise commandée a été reçue.
        </p>
      ) : (
        <form onSubmit={receive} className="mt-5 space-y-4" noValidate>
          <h3 className="text-sm font-medium text-ink">Ce que vous recevez aujourd&apos;hui</h3>
          <p className="text-sm text-ink-muted">
            Ajustez les quantités si la livraison ne correspond pas exactement à la commande — le
            reste pourra être réceptionné plus tard.
          </p>

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
            <Field
              label="Date de péremption du lot (facultatif)"
              htmlFor="expiryDate"
              hint="Pour les denrées ou cosmétiques."
            >
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
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-surface-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{item.productName}</p>
                    <p className="text-xs text-ink-muted">
                      Commandé : {item.quantityOrdered} · Déjà reçu : {item.quantityReceived} ·
                      Reste : {remaining}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={remaining}
                    step={0.001}
                    value={suggested(item)}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                    className={cx(inputClass, 'w-28')}
                  />
                </div>
              );
            })}
          </div>

          <Button type="submit" loading={mutation.isPending('reception')} disabled={!warehouseId}>
            Confirmer la réception
          </Button>
        </form>
      )}

      {/* ----------------------------------------------------- Le paiement */}
      <PaymentPanel
        remaining={order.payment.remaining}
        currency={currency}
        pending={mutation.isPending('paiement')}
        disabled={mutation.pending}
        onPay={pay}
      />

      <div className="mt-5 border-t border-surface-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.pending}>
          Fermer
        </Button>
      </div>
    </Card>
  );
}

/**
 * Règlement d'une commande, depuis l'écran de réception.
 *
 * Deux gestes, parce qu'il n'y a que deux situations réelles : on solde la
 * commande, ou on verse un acompte. « Marquer comme payé » évite de retaper un
 * montant que le produit connaît déjà — et un montant retapé est un montant
 * qu'on peut mal taper.
 */
function PaymentPanel({
  remaining,
  currency,
  pending,
  disabled,
  onPay,
}: {
  remaining: number;
  currency: string;
  pending: boolean;
  disabled: boolean;
  onPay: (amount: number, note?: string) => void;
}) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (remaining <= 0) {
    return (
      <p className="mt-5 rounded-xl bg-state-ok-soft px-4 py-3 text-sm font-medium text-state-ok">
        Cette commande est réglée. Rien à verser.
      </p>
    );
  }

  function submitPartial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let minor: number;
    try {
      minor = toMinor(amount, currency);
    } catch {
      return;
    }
    if (minor <= 0) return;
    onPay(minor, note);
    setAmount('');
    setNote('');
    setPartial(false);
  }

  return (
    <div className="mt-5 border-t border-surface-border pt-5">
      <h3 className="text-sm font-medium text-ink">Régler cette commande</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Reste à payer : {formatMoney(remaining, currency)}
      </p>

      {partial ? (
        <form onSubmit={submitPartial} className="mt-3 space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Montant versé (${currency})`} htmlFor="acompte" required>
              <input
                id="acompte"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className={inputClass}
                placeholder="0"
              />
            </Field>
            <Field label="Note (facultatif)" htmlFor="acompteNote">
              <input
                id="acompteNote"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={pending} disabled={disabled}>
              Enregistrer le versement
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPartial(false)}
              disabled={disabled}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            loading={pending}
            disabled={disabled}
            onClick={() => onPay(remaining)}
          >
            Marquer comme payé · {formatMoney(remaining, currency)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => setPartial(true)}
          >
            Verser un acompte
          </Button>
        </div>
      )}
    </div>
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
  const mutation = useServerMutation();
  const pending = mutation.pending;

  // Seules les commandes qui doivent encore quelque chose : proposer une
  // commande déjà soldée ne mène qu'à un règlement en trop.
  const unsettled = orders.filter((order) => order.payment.remaining > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    mutation.run(
      () =>
        api.post(`/api/boutique/suppliers/${supplier.id}/payments`, {
          amount: toMinor(String(formData.get('amount') ?? '0'), currency),
          purchaseOrderId: String(formData.get('purchaseOrderId') ?? '') || undefined,
          note: String(formData.get('note') ?? '') || undefined,
        }),
      {
        // Le parent affiche déjà la confirmation en refermant le formulaire.
        onSuccess: onDone,
        skipRefresh: true,
        failureMessage: "L'enregistrement a échoué.",
      },
    );
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Paiement — {supplier.name}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Reste à régler chez ce fournisseur : {formatMoney(supplier.outstanding, currency)}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <AlertMessage message={mutation.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant" htmlFor="amount" required>
            <input id="amount" name="amount" type="number" min={0.01} step="0.01" required className={inputClass} />
          </Field>
          {/* Le règlement se rattache à une commande. Un versement flottant,
              rattaché au seul fournisseur, ne permettait de dire d'aucune
              commande si elle était payée — et c'est la question que le
              commerçant se pose devant sa pile de bons de livraison. */}
          <Field
            label="Commande réglée"
            htmlFor="purchaseOrderId"
            hint="Seules les commandes livrées et non soldées apparaissent ici."
            required
          >
            <select id="purchaseOrderId" name="purchaseOrderId" required className={inputClass}>
              <option value="">Choisir une commande</option>
              {unsettled.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.reference} — reste {formatMoney(order.payment.remaining, currency)}
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
