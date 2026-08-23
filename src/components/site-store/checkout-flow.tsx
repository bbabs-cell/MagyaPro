'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { UNIT_LABELS, quantityStep } from '@/lib/boutique/units';
import { useCart } from '@/components/site-store/cart-context';

/**
 * Panier + coordonnées, en une seule page — pas d'étape de paiement : la
 * commande est à régler au retrait en boutique. Le client n'est jamais un
 * compte : nom/téléphone suffisent, comme pour la commande invité du site
 * Restaurant.
 */
export function CheckoutFlow({
  storeId,
  host,
  currency,
}: {
  storeId: string;
  host: string;
  currency: string;
}) {
  const router = useRouter();
  const { lines, total, setQuantity, removeLine, clear } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit() {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const { order } = await api.post<{ order: { id: string } }>('/api/public/boutique/commande', {
        storeId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        notes: notes || undefined,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      });
      clear();
      router.push(`/s/${host}/commande/${order.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La commande n'a pas pu être envoyée.");
      }
    } finally {
      setPending(false);
    }
  }

  if (lines.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
        Votre panier est vide.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_320px]">
      <div>
        <ul className="divide-y divide-gray-100">
          {lines.map((line) => (
            <li key={line.productId} className="flex items-center gap-3 py-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image déposée par le tenant
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-gray-300">
                    {line.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-gray-500">
                  {formatMoney(line.unitPrice, currency)}
                  {line.unit !== 'UNIT' && ` / ${UNIT_LABELS[line.unit]}`}
                </p>
              </div>
              <input
                type="number"
                min={quantityStep(line.unit)}
                max={line.maxStock}
                step={quantityStep(line.unit)}
                value={line.quantity}
                onChange={(event) => setQuantity(line.productId, Number(event.target.value))}
                className="h-10 w-20 rounded-lg border border-gray-300 px-2 text-center text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(line.productId)}
                aria-label={`Retirer ${line.name}`}
                className="shrink-0 text-gray-400 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-medium">Vos coordonnées</h2>
        <p className="mt-1 text-xs text-gray-500">
          À retirer en boutique — vous réglerez sur place.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="customerName" className="block text-xs font-medium text-gray-600">
              Nom
            </label>
            <input
              id="customerName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
            {fieldErrors.customerName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.customerName}</p>
            )}
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-xs font-medium text-gray-600">
              Téléphone
            </label>
            <input
              id="customerPhone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
            {fieldErrors.customerPhone && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.customerPhone}</p>
            )}
          </div>
          <div>
            <label htmlFor="customerEmail" className="block text-xs font-medium text-gray-600">
              Email (facultatif)
            </label>
            <input
              id="customerEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-xs font-medium text-gray-600">
              Message (facultatif)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={pending || !name.trim() || !phone.trim()}
          onClick={submit}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? 'Envoi…' : `Commander — ${formatMoney(total, currency)}`}
        </button>
      </div>
    </div>
  );
}
