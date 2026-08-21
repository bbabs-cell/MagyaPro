'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

/**
 * Caisse (POS) — première version : un seul moyen de paiement par vente,
 * pas encore de client associé ni de paiement scindé. La recherche filtre
 * côté client une liste déjà chargée : suffisant pour un catalogue de
 * quelques centaines de références, à revoir (recherche serveur paginée)
 * si un commerce dépasse cette taille.
 */

type Product = {
  id: string;
  name: string;
  variantId: string;
  price: number;
  stock: number;
};

type CartLine = { variantId: string; name: string; unitPrice: number; quantity: number; maxStock: number };

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' },
];

export function Pos({ products, currency }: { products: Product[]; currency: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]!.value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ number: number; total: number } | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => p.name.toLowerCase().includes(needle));
  }, [products, query]);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function addToCart(product: Product) {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.variantId === product.variantId);
      if (existing) {
        if (existing.quantity >= product.stock) return current;
        return current.map((line) =>
          line.variantId === product.variantId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      if (product.stock <= 0) return current;
      return [
        ...current,
        {
          variantId: product.variantId,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          maxStock: product.stock,
        },
      ];
    });
  }

  function updateQuantity(variantId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: Math.max(1, Math.min(quantity, line.maxStock)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(variantId: string) {
    setCart((current) => current.filter((line) => line.variantId !== variantId));
  }

  async function checkout() {
    if (cart.length === 0) return;
    setPending(true);
    setError(null);
    setLastReceipt(null);

    try {
      const { sale } = await api.post<{ sale: { number: number; total: number } }>(
        '/api/boutique/sales',
        {
          items: cart.map((line) => ({ productVariantId: line.variantId, quantity: line.quantity })),
          paymentMethod,
        },
      );
      setLastReceipt({ number: sale.number, total: sale.total });
      setCart([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La vente n'a pas pu être enregistrée.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un produit…"
          className={cx(inputClass, 'mb-4')}
          autoFocus
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun produit ne correspond à cette recherche.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <button
                key={product.variantId}
                type="button"
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="card flex flex-col items-start gap-1 p-4 text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium text-ink">{product.name}</span>
                <span className="text-sm text-ink-muted">{formatMoney(product.price, currency)}</span>
                <Badge tone={product.stock > 0 ? 'neutral' : 'danger'}>
                  {product.stock > 0 ? `${product.stock} en stock` : 'Rupture'}
                </Badge>
              </button>
            ))}
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

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Ajoutez des produits pour commencer une vente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cart.map((line) => (
              <li key={line.variantId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-ink-muted">{formatMoney(line.unitPrice, currency)}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={line.maxStock}
                  value={line.quantity}
                  onChange={(event) => updateQuantity(line.variantId, Number(event.target.value))}
                  className="w-14 rounded-lg border border-surface-border px-2 py-1 text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeLine(line.variantId)}
                  aria-label={`Retirer ${line.name}`}
                  className="shrink-0 text-ink-faint hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-4 text-sm font-semibold">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>

        <div className="mt-4">
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-ink">
            Moyen de paiement
          </label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className={cx(inputClass, 'mt-1.5')}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          size="lg"
          loading={pending}
          disabled={cart.length === 0}
          onClick={checkout}
        >
          Encaisser {formatMoney(total, currency)}
        </Button>
      </Card>
    </div>
  );
}
