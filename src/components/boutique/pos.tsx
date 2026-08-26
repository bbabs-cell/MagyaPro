'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { UNIT_LABELS, isDecimalUnit, quantityStep } from '@/lib/boutique/units';
import { enqueueSale } from '@/lib/boutique/offline-queue';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

/**
 * Caisse (POS).
 *
 * La recherche filtre côté client une liste déjà chargée : suffisant pour un
 * catalogue de quelques centaines de références, à revoir (recherche
 * serveur paginée) si un commerce dépasse cette taille.
 *
 * Un scanner code-barres USB/Bluetooth se comporte comme un clavier : il
 * tape les chiffres puis Entrée. La recherche les reconnaît — une
 * correspondance exacte sur `barcode` ajoute directement l'article au
 * panier plutôt que de simplement filtrer la liste.
 */

type Product = {
  id: string;
  name: string;
  variantId: string;
  price: number;
  /** Nombre d'unités de base par carton, `null` si ce produit ne se vend
   *  pas au carton — voir `StoreProductVariant.packSize`. */
  packSize: number | null;
  packPrice: number | null;
  stock: number;
  unit: string;
  barcode: string | null;
};

type SaleUnit = 'UNIT' | 'PACK';

type Customer = {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
  creditLimit: number;
};

type CartLine = {
  variantId: string;
  /** Vendu à l'unité de base ou par carton complet — deux lignes distinctes
   *  du même produit peuvent coexister dans le panier (une par mode). */
  saleUnit: SaleUnit;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Quantité maximale exprimée dans l'unité vendue (cartons ou unités). */
  maxStock: number;
  unit: string;
};

type PaymentLine = { method: string; amount: string };
type PaymentMethodOption = { value: string; label: string };

export function Pos({
  storeId,
  products,
  customers,
  currency,
  taxEnabled,
  taxRate,
  paymentMethods,
  readOnly = false,
}: {
  storeId: string;
  products: Product[];
  customers: Customer[];
  currency: string;
  /** TVA de la boutique — voir `Store.taxEnabled`/`taxRate` (dixièmes de %). */
  taxEnabled: boolean;
  taxRate: number;
  /** Moyens de paiement actifs de la boutique — voir `payment-methods.ts`. */
  paymentMethods: PaymentMethodOption[];
  /**
   * Visite guidée d'une boutique de démonstration (voir `getDemoTourContext`) :
   * le panier reste explorable, mais l'encaissement est bloqué avant même
   * d'appeler l'API — qui le refuserait de toute façon côté serveur.
   */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([
    { method: paymentMethods[0]?.value ?? 'cash', amount: '' },
  ]);
  const [customerId, setCustomerId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ number: number; total: number } | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.barcode?.toLowerCase() === needle,
    );
  }, [products, query]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const taxableAmount = subtotal - discountAmount;
  // Estimation : le code promo, lui, n'est vérifié et chiffré que côté serveur.
  const taxAmount = taxEnabled ? Math.round((taxableAmount * taxRate) / 1000) : 0;
  const total = taxableAmount + taxAmount;

  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(total - paymentsTotal, 0);
  const customer = customers.find((c) => c.id === customerId) ?? null;

  function addToCart(product: Product, saleUnit: SaleUnit = 'UNIT') {
    setError(null);
    const isPack = saleUnit === 'PACK';
    if (isPack && (!product.packSize || !product.packPrice)) return;
    const step = isPack ? 1 : quantityStep(product.unit);
    // Le stock (`product.stock`) est toujours compté en unités de base —
    // converti ici en nombre de cartons complets disponibles pour une ligne
    // vendue au carton.
    const maxStock = isPack ? Math.floor(product.stock / product.packSize!) : product.stock;
    const unitPrice = isPack ? product.packPrice! : product.price;
    const name = isPack ? `${product.name} — carton ×${product.packSize}` : product.name;

    setCart((current) => {
      const existing = current.find(
        (line) => line.variantId === product.variantId && line.saleUnit === saleUnit,
      );
      if (existing) {
        if (existing.quantity >= maxStock) return current;
        return current.map((line) =>
          line.variantId === product.variantId && line.saleUnit === saleUnit
            ? { ...line, quantity: Math.min(line.quantity + step, line.maxStock) }
            : line,
        );
      }
      if (maxStock <= 0) return current;
      return [
        ...current,
        { variantId: product.variantId, saleUnit, name, unitPrice, quantity: step, maxStock, unit: product.unit },
      ];
    });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = products.find((p) => p.barcode?.toLowerCase() === needle);
    if (!match) return;
    event.preventDefault();
    if (match.stock <= 0) {
      setError(`${match.name} : rupture de stock.`);
      return;
    }
    addToCart(match);
    setQuery('');
  }

  function updateQuantity(variantId: string, saleUnit: SaleUnit, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.variantId === variantId && line.saleUnit === saleUnit
            ? {
                ...line,
                quantity: Math.max(
                  saleUnit === 'PACK' ? 1 : quantityStep(line.unit),
                  Math.min(quantity, line.maxStock),
                ),
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(variantId: string, saleUnit: SaleUnit) {
    setCart((current) => current.filter((line) => !(line.variantId === variantId && line.saleUnit === saleUnit)));
  }

  function addPaymentLine() {
    const usedMethods = new Set(payments.map((p) => p.method));
    const nextMethod =
      paymentMethods.find((m) => !usedMethods.has(m.value))?.value ??
      paymentMethods[0]?.value ??
      'cash';
    setPayments((current) => [...current, { method: nextMethod, amount: String(remaining || '') }]);
  }

  function updatePaymentLine(index: number, patch: Partial<PaymentLine>) {
    setPayments((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removePaymentLine(index: number) {
    setPayments((current) => current.filter((_, i) => i !== index));
  }

  async function checkout() {
    if (cart.length === 0) return;
    if (readOnly) {
      setError('Encaissement désactivé en mode démonstration — explorez librement le panier et le catalogue.');
      return;
    }
    setPending(true);
    setError(null);
    setLastReceipt(null);
    setQueuedOffline(false);

    const payload = {
      items: cart.map((line) => ({
        productVariantId: line.variantId,
        quantity: line.quantity,
        saleUnit: line.saleUnit,
      })),
      customerId: customerId || undefined,
      discount: discountAmount,
      promoCode: promoCode.trim() || undefined,
      payments: payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount) })),
    };

    function resetCart() {
      setCart([]);
      setDiscount('');
      setPromoCode('');
      setPayments([{ method: paymentMethods[0]?.value ?? 'cash', amount: '' }]);
    }

    try {
      const { sale } = await api.post<{ sale: { number: number; total: number } }>(
        '/api/boutique/sales',
        payload,
      );
      setLastReceipt({ number: sale.number, total: sale.total });
      resetCart();
      router.refresh();
    } catch (err) {
      // Panne réseau : la vente est mise en attente localement plutôt que
      // perdue — voir `offline-queue.ts`. Toute autre erreur (stock
      // insuffisant, client invalide...) reste affichée immédiatement, elle
      // n'a rien à voir avec la connexion.
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
        enqueueSale(storeId, payload);
        setQueuedOffline(true);
        resetCart();
      } else {
        setError(err instanceof ApiError ? err.message : "La vente n'a pas pu être enregistrée.");
      }
    } finally {
      setPending(false);
    }
  }

  const canCheckout = cart.length > 0 && (remaining === 0 || Boolean(customer));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Rechercher un produit ou scanner un code-barres…"
          className={cx(inputClass, 'mb-4')}
          autoFocus
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun produit ne correspond à cette recherche.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const canSellPack = Boolean(product.packSize && product.packPrice);
              return (
                <div
                  key={product.variantId}
                  className="card flex flex-col items-start gap-1 p-4 text-left transition-shadow hover:shadow-md"
                >
                  <span className="font-medium text-ink">{product.name}</span>
                  <Badge tone={product.stock > 0 ? 'neutral' : 'danger'}>
                    {product.stock > 0
                      ? `${product.stock} ${UNIT_LABELS[product.unit]} en stock`
                      : 'Rupture'}
                  </Badge>
                  <div className="mt-1.5 flex w-full flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => addToCart(product, 'UNIT')}
                      disabled={product.stock <= 0}
                      className="flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unité
                      <br />
                      {formatMoney(product.price, currency)}
                    </button>
                    {canSellPack && (
                      <button
                        type="button"
                        onClick={() => addToCart(product, 'PACK')}
                        disabled={product.stock < product.packSize!}
                        className="flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Carton ×{product.packSize}
                        <br />
                        {formatMoney(product.packPrice!, currency)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Card className="h-fit p-4 sm:p-5">
        <h2 className="font-semibold text-ink">Panier</h2>

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {lastReceipt && (
          <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Vente n°{lastReceipt.number} enregistrée — {formatMoney(lastReceipt.total, currency)}
          </div>
        )}

        {queuedOffline && (
          <div role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Pas de connexion — vente enregistrée localement, elle sera envoyée automatiquement dès le
            retour du réseau.
          </div>
        )}

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Ajoutez des produits pour commencer une vente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cart.map((line) => {
              const step = line.saleUnit === 'PACK' ? 1 : quantityStep(line.unit);
              return (
                <li key={`${line.variantId}:${line.saleUnit}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-ink-muted">{formatMoney(line.unitPrice, currency)}</p>
                  </div>
                  <input
                    type="number"
                    min={step}
                    max={line.maxStock}
                    step={step}
                    value={line.quantity}
                    onChange={(event) =>
                      updateQuantity(line.variantId, line.saleUnit, Number(event.target.value))
                    }
                    className="w-16 rounded-lg border border-surface-border px-2 py-1 text-center text-sm"
                  />
                  {line.saleUnit === 'UNIT' && isDecimalUnit(line.unit) && (
                    <span className="text-xs text-ink-faint">{UNIT_LABELS[line.unit]}</span>
                  )}
                  {line.saleUnit === 'PACK' && <span className="text-xs text-ink-faint">carton(s)</span>}
                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId, line.saleUnit)}
                    aria-label={`Retirer ${line.name}`}
                    className="shrink-0 text-ink-faint hover:text-red-600"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4">
          <label htmlFor="discount" className="block text-sm font-medium text-ink">
            Remise (montant)
          </label>
          <input
            id="discount"
            type="number"
            min={0}
            max={subtotal}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            placeholder="0"
            className={cx(inputClass, 'mt-1.5')}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="promoCode" className="block text-sm font-medium text-ink">
            Code promo (facultatif)
          </label>
          <input
            id="promoCode"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            placeholder="SOLDES20"
            className={cx(inputClass, 'mt-1.5 font-mono uppercase')}
          />
        </div>

        <div className="mt-4 space-y-1 border-t border-surface-border pt-4 text-sm">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Sous-total</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>Remise</span>
              <span>−{formatMoney(discountAmount, currency)}</span>
            </div>
          )}
          {taxEnabled && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>TVA ({(taxRate / 10).toLocaleString('fr-FR')} %)</span>
              <span>{formatMoney(taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        {customers.length > 0 && (
          <div className="mt-4">
            <label htmlFor="customerId" className="block text-sm font-medium text-ink">
              Client (facultatif)
            </label>
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={cx(inputClass, 'mt-1.5')}
            >
              <option value="">Aucun</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Paiement</p>
          <div className="mt-1.5 space-y-2">
            {payments.map((line, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={line.method}
                  onChange={(event) => updatePaymentLine(index, { method: event.target.value })}
                  className={cx(inputClass, 'flex-1')}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={line.amount}
                  onChange={(event) => updatePaymentLine(index, { amount: event.target.value })}
                  placeholder="0"
                  className={cx(inputClass, 'w-28')}
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePaymentLine(index)}
                    aria-label="Retirer ce paiement"
                    className="shrink-0 text-ink-faint hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {payments.length < paymentMethods.length && (
            <button
              type="button"
              onClick={addPaymentLine}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              + Scinder le paiement
            </button>
          )}

          {remaining > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              {customer ? (
                <>
                  Reste à crédit sur {customer.name} : <strong>{formatMoney(remaining, currency)}</strong>
                </>
              ) : (
                <>
                  Reste non couvert : <strong>{formatMoney(remaining, currency)}</strong> — choisissez un
                  client pour le mettre à crédit.
                </>
              )}
            </p>
          )}
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          size="lg"
          loading={pending}
          disabled={!canCheckout || readOnly}
          onClick={checkout}
        >
          {readOnly ? 'Encaissement désactivé (démo)' : `Encaisser ${formatMoney(total, currency)}`}
        </Button>
      </Card>
    </div>
  );
}
