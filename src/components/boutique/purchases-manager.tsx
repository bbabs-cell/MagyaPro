'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { AlertMessage, Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TONES } from '@/lib/boutique/labels';
import {
  PURCHASE_PAYMENT_LABELS,
  PURCHASE_PAYMENT_TONES,
  type PurchaseBalance,
} from '@/lib/boutique/purchase-payment';

/** `outstanding` : reste dû, déduit des commandes livrées — plus un compteur. */
type Supplier = { id: string; name: string; outstanding: number };
/** `cost` : dernier coût d'achat enregistré du produit, en unité mineure. */
type ProductOption = {
  variantId: string;
  name: string;
  categoryName: string | null;
  cost: number;
};
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

/**
 * Composition d'une commande fournisseur.
 *
 * Même disposition que la Caisse et que la prise de commande Restaurant :
 * catalogue à gauche, commande à droite, visibles en même temps. C'est le
 * même geste — composer une liste de produits — fait par la même personne.
 * Trois écrans de saisie qui se ressemblent s'apprennent une fois.
 *
 * Ce que cela remplace : un tableau de lignes vides, où chaque produit se
 * choisissait dans une liste déroulante de tout le catalogue, et où il fallait
 * descendre pour lire le total puis remonter pour corriger une quantité.
 *
 * Une différence assumée avec la caisse : on n'achète pas au prix de vente.
 * Chaque ligne garde donc son coût unitaire et sa remise, saisissables. Ils
 * sont pré-remplis avec le dernier coût d'achat connu du produit, qui est une
 * donnée réelle et non une estimation — à zéro quand il n'a jamais été
 * renseigné, auquel cas le champ reste à zéro plutôt que d'afficher un montant
 * inventé.
 */
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
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [expectedAt, setExpectedAt] = useState('');
  const [note, setNote] = useState('');
  // Les frais annexes entrent dans le total affiché : un total qui ignore le
  // transport n'est pas le total.
  const [extraFees, setExtraFees] = useState('0');

  const [lines, setLines] = useState<
    Array<{ variantId: string; name: string; quantity: number; unitCost: string; discount: string }>
  >([]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        (product.categoryName ?? '').toLowerCase().includes(needle),
    );
  }, [products, search]);

  const linesTotal = lines.reduce((sum, line) => {
    const unitCost = Number(line.unitCost.replace(',', '.')) || 0;
    const discount = Number(line.discount.replace(',', '.')) || 0;
    return sum + Math.max(0, unitCost - discount) * (line.quantity || 0);
  }, 0);
  const feesValue = Number(extraFees.replace(',', '.')) || 0;
  const total = linesTotal + feesValue;

  function addProduct(product: ProductOption) {
    setLines((current) => {
      const existing = current.find((line) => line.variantId === product.variantId);
      if (existing) {
        return current.map((line) =>
          line.variantId === product.variantId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          variantId: product.variantId,
          name: product.name,
          quantity: 1,
          unitCost: String(toMajor(product.cost, currency)),
          discount: '0',
        },
      ];
    });
  }

  function updateLine(
    variantId: string,
    patch: Partial<{ quantity: number; unitCost: string; discount: string }>,
  ) {
    setLines((current) =>
      current.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line)),
    );
  }

  function setQuantity(variantId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.variantId !== variantId)
        : current.map((line) => (line.variantId === variantId ? { ...line, quantity } : line)),
    );
  }

  async function submit(confirm: boolean) {
    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/purchase-orders', {
        supplierId,
        confirm,
        extraFees: toMinor(extraFees || '0', currency),
        expectedAt: expectedAt || undefined,
        note: note || undefined,
        items: lines.map((line) => ({
          productVariantId: line.variantId,
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

  const ready = lines.length > 0 && supplierId !== '';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Dégage la barre inférieure, qui recouvrirait les derniers produits. */}
      <div className="max-lg:pb-24">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un produit…"
          className={cx(inputClass, 'mb-4')}
          autoFocus
        />

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border px-4 py-8 text-center text-sm text-ink-muted">
            {products.length === 0
              ? 'Aucun produit au catalogue. Créez-en un avant de commander.'
              : `Aucun produit ne correspond à « ${search.trim()} ».`}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((product: ProductOption) => {
              const inOrder = lines.find((line) => line.variantId === product.variantId);
              return (
                <button
                  key={product.variantId}
                  type="button"
                  onClick={() => addProduct(product)}
                  style={{ touchAction: 'manipulation' }}
                  className={cx(
                    'flex items-start justify-between gap-3 rounded-xl border bg-surface-raised p-3 text-start transition-colors hover:bg-surface-sunken',
                    inOrder ? 'border-ink' : 'border-surface-border',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {product.name}
                    </span>
                    {product.categoryName && (
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">
                        {product.categoryName}
                      </span>
                    )}
                    <span className="mt-1.5 block text-sm tabular-nums text-ink-muted">
                      {product.cost > 0
                        ? `Dernier coût ${formatMoney(product.cost, currency)}`
                        : 'Coût à saisir'}
                    </span>
                  </span>

                  {inOrder && (
                    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium tabular-nums text-brand">
                      ×{inOrder.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Voile derrière la feuille : un appui à côté referme. */}
      {sheetOpen && (
        <button
          type="button"
          aria-label="Fermer la commande"
          onClick={() => setSheetOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      )}

      <Card
        className={cx(
          'h-fit p-4 sm:p-5',
          'lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto',
          'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[85vh]',
          'max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-b-none',
          'max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]',
          !sheetOpen && 'max-lg:hidden',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">Commande d&apos;achat</h2>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            style={{ touchAction: 'manipulation' }}
            className="-mr-2 rounded-lg px-3 py-2 text-sm text-ink-muted lg:hidden"
          >
            Fermer
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Choisissez des produits dans le catalogue pour composer la commande.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {lines.map((line) => {
              const unitCost = Number(line.unitCost.replace(',', '.')) || 0;
              const discount = Number(line.discount.replace(',', '.')) || 0;
              // Total de la ligne en clair : c'est le seul moyen de repérer
              // d'un coup d'œil qu'on a interverti la quantité et le prix —
              // 4500 articles à 12 F saute alors aux yeux.
              const lineTotal = Math.max(0, unitCost - discount) * (line.quantity || 0);

              return (
                <li key={line.variantId} className="border-b border-surface-border pb-3 last:border-0">
                  {/* Le nom occupe sa propre ligne : serré à côté des trois
                      commandes de quantité, « Café Touba 250 g » se brisait en
                      quatre lignes d'un mot. Les noms d'épicerie sont longs,
                      et aucune largeur de colonne ne rattrapera cela. */}
                  <p className="text-sm font-medium text-ink">{line.name}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Retirer un ${line.name}`}
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        style={{ touchAction: 'manipulation' }}
                        className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0.001}
                        step={0.001}
                        value={line.quantity}
                        aria-label={`Quantité de ${line.name}`}
                        onChange={(event) =>
                          updateLine(line.variantId, { quantity: Number(event.target.value) })
                        }
                        className={cx(inputClass, '!w-16 shrink-0 px-1 text-center tabular-nums')}
                      />
                      <button
                        type="button"
                        aria-label={`Ajouter un ${line.name}`}
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                        style={{ touchAction: 'manipulation' }}
                        className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken"
                      >
                        +
                      </button>
                    </div>

                    <p className="whitespace-nowrap text-sm tabular-nums">
                      <span className="text-ink-muted">Total </span>
                      <span className="font-semibold text-ink">
                        {formatMoney(toMinor(String(lineTotal), currency), currency)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label={`Coût unitaire (${currency})`} htmlFor={`cost-${line.variantId}`}>
                      <input
                        id={`cost-${line.variantId}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(line.variantId, { unitCost: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label={`Remise / unité (${currency})`} htmlFor={`disc-${line.variantId}`}>
                      <input
                        id={`disc-${line.variantId}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(line.variantId, { discount: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="mt-3 border-t border-surface-border pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink-muted">
                {lines.length} produit{lines.length > 1 ? 's' : ''}
              </span>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {formatMoney(toMinor(String(total), currency), currency)}
              </span>
            </div>
            {feesValue > 0 && (
              <p className="mt-0.5 text-end text-xs text-ink-faint">
                dont {formatMoney(toMinor(String(feesValue), currency), currency)} de frais annexes
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3 border-t border-surface-border pt-4">
          <Field label="Fournisseur" htmlFor="supplierId" required>
            <select
              id="supplierId"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className={inputClass}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Livraison attendue" htmlFor="expectedAt">
            <input
              id="expectedAt"
              type="date"
              value={expectedAt}
              onChange={(event) => setExpectedAt(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Frais annexes" htmlFor="extraFees" hint="Transport, douane…">
            <input
              id="extraFees"
              inputMode="decimal"
              value={extraFees}
              onChange={(event) => setExtraFees(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Note" htmlFor="note">
            <input
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClass}
              placeholder="Facultatif"
            />
          </Field>

          <div className="space-y-2 pt-1">
            <Button
              type="button"
              size="lg"
              className="w-full"
              loading={pending}
              disabled={!ready}
              onClick={() => void submit(true)}
              style={{ touchAction: 'manipulation' }}
            >
              Commander
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={pending || !ready}
                onClick={() => void submit(false)}
              >
                Brouillon
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Barre inférieure sur téléphone : le montant engagé reste sous les
          yeux pendant qu'on parcourt le catalogue. */}
      {!sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-raised shadow-elev2 lg:hidden">
          <div className="flex items-center gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">
                {lines.length === 0
                  ? 'Aucun produit'
                  : `${lines.length} produit${lines.length > 1 ? 's' : ''}`}
              </p>
              <p className="truncate text-lg font-semibold tabular-nums text-ink">
                {formatMoney(toMinor(String(total), currency), currency)}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              variant={lines.length === 0 ? 'secondary' : 'primary'}
              onClick={() => setSheetOpen(true)}
              style={{ touchAction: 'manipulation' }}
              className="shrink-0"
            >
              {lines.length === 0 ? 'Détails' : 'Voir la commande'}
            </Button>
          </div>
        </div>
      )}
    </div>
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
