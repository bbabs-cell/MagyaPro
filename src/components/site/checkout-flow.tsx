'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import { Field, inputClass } from '@/components/ui';
import { toCheckoutItems, useCart } from '@/components/site/cart-context';
import { getTableToken } from '@/lib/site/table-session';

/**
 * Tunnel de commande.
 *
 * Deux temps : le panier (modifiable), puis les coordonnées. À chaque
 * changement susceptible d'affecter le prix, le total est redemandé au serveur
 * — c'est lui qui fait autorité, l'estimation locale ne sert qu'à éviter un
 * écran vide pendant l'appel.
 */

type Zone = {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  freeAbove: number | null;
};

type Quote = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  currency: string;
  promoCode: string | null;
};

export function CheckoutFlow({
  host,
  restaurantId,
  currency,
  orderingEnabled,
  deliveryEnabled,
  pickupEnabled,
  minOrderAmount,
  prepTimeMinutes,
  zones,
  providers,
}: {
  host: string;
  restaurantId: string;
  currency: string;
  orderingEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  minOrderAmount: number;
  prepTimeMinutes: number;
  zones: Zone[];
  providers: Array<{ id: string; label: string; description: string }>;
}) {
  const router = useRouter();
  const { lines, estimatedSubtotal, setQuantity, removeLine, clear } = useCart();

  // Un client qui a scanné le QR d'une table commande depuis sa table : le
  // mode est déduit du jeton mémorisé au scan, pas d'un choix qu'il ferait ici.
  const [tableToken, setTableTokenState] = useState<string | null>(null);
  useEffect(() => {
    setTableTokenState(getTableToken(restaurantId));
  }, [restaurantId]);

  const [fulfillment, setFulfillment] = useState<'DELIVERY' | 'PICKUP' | 'DINE_IN'>(
    deliveryEnabled ? 'DELIVERY' : 'PICKUP',
  );
  useEffect(() => {
    if (tableToken) setFulfillment('DINE_IN');
  }, [tableToken]);
  const [zoneId, setZoneId] = useState<string | null>(zones[0]?.id ?? null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');

  const refreshQuote = useCallback(async () => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }

    setQuoting(true);
    setQuoteError(null);

    try {
      const result = await api.post<Quote>('/api/public/devis', {
        restaurantId,
        items: toCheckoutItems(lines),
        fulfillmentType: fulfillment,
        deliveryZoneId: fulfillment === 'DELIVERY' ? zoneId : null,
        promoCode: appliedPromo ?? undefined,
      });
      setQuote(result);
    } catch (error) {
      setQuote(null);
      setQuoteError(
        error instanceof ApiError
          ? error.message
          : 'Le total n\'a pas pu être calculé. Réessayez.',
      );
      // Un code promo devenu invalide (expiré, épuisé) est retiré pour que le
      // client puisse continuer sa commande sans rester bloqué.
      if (error instanceof ApiError && appliedPromo && error.message.includes('promo')) {
        setAppliedPromo(null);
        setPromoError(error.message);
      }
    } finally {
      setQuoting(false);
    }
  }, [lines, restaurantId, fulfillment, zoneId, appliedPromo]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  async function applyPromo(event: FormEvent) {
    event.preventDefault();
    setPromoError(null);
    setAppliedPromo(promoInput.trim().toUpperCase() || null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    try {
      const result = await api.post<{
        confirmationUrl: string;
        payment: { instructions: string | null; redirectUrl: string | null };
      }>('/api/public/commande', {
        restaurantId,
        items: toCheckoutItems(lines),
        fulfillmentType: fulfillment,
        deliveryZoneId: fulfillment === 'DELIVERY' ? zoneId : null,
        tableToken: fulfillment === 'DINE_IN' ? (tableToken ?? undefined) : undefined,
        promoCode: appliedPromo ?? undefined,
        customerName: String(formData.get('customerName') ?? ''),
        customerPhone: String(formData.get('customerPhone') ?? ''),
        customerEmail: String(formData.get('customerEmail') ?? ''),
        deliveryAddress: String(formData.get('deliveryAddress') ?? ''),
        instructions: String(formData.get('instructions') ?? ''),
        paymentProvider: providerId,
      });

      // Le panier n'est vidé qu'après confirmation de la création : en cas
      // d'échec, le client retrouve sa commande intacte.
      clear();

      if (result.payment.redirectUrl) {
        window.location.href = result.payment.redirectUrl;
        return;
      }
      router.push(result.confirmationUrl);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setSubmitError("La commande n'a pas pu être envoyée. Réessayez.");
      }
      setSubmitting(false);
    }
  }

  if (!orderingEnabled) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-sunken p-6">
        <p className="font-medium">Les commandes en ligne sont fermées.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Ce restaurant n&apos;accepte pas de commande pour le moment.
        </p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border p-10 text-center">
        <p className="font-medium">Votre panier est vide</p>
        <p className="mt-1 text-sm text-ink-muted">
          Parcourez la carte pour composer votre commande.
        </p>
        <Link
          href={`/r/${host}/menu`}
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-6 font-medium text-white"
        >
          Voir le menu
        </Link>
      </div>
    );
  }

  const displayTotal = quote?.total ?? estimatedSubtotal;
  const belowMinimum = (quote?.subtotal ?? estimatedSubtotal) < minOrderAmount;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* ------------------------------------------------------- Articles */}
        <section aria-label="Articles du panier">
          <ul className="divide-y divide-surface-border rounded-2xl border border-surface-border">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-3 p-3 sm:p-4">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                  <img
                    src={line.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-16 w-16 shrink-0 rounded-xl bg-surface-sunken"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.productName}</p>
                  {line.variantName && (
                    <p className="text-sm text-ink-muted">{line.variantName}</p>
                  )}
                  {line.options.length > 0 && (
                    <p className="text-sm text-ink-muted">
                      {line.options.map((option) => option.name).join(', ')}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-surface-border">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="h-9 w-9 hover:bg-surface-sunken"
                        aria-label={`Diminuer la quantité de ${line.productName}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        className="h-9 w-9 hover:bg-surface-sunken"
                        aria-label={`Augmenter la quantité de ${line.productName}`}
                      >
                        +
                      </button>
                    </div>

                    <span className="text-sm font-medium">
                      {formatMoney(line.unitPrice * line.quantity, currency)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="self-start text-sm text-ink-faint hover:text-red-600"
                >
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">Retirer {line.productName}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------- Récupération */}
        <section aria-label="Mode de récupération" className="rounded-2xl border border-surface-border p-4">
          {tableToken ? (
            <p className="text-sm font-medium">
              Vous commandez depuis votre table — servi directement sur place.
            </p>
          ) : (
            <>
              <h2 className="text-sm font-medium">Comment souhaitez-vous être servi ?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {deliveryEnabled && (
                  <FulfillmentButton
                    active={fulfillment === 'DELIVERY'}
                    onClick={() => setFulfillment('DELIVERY')}
                    label="Livraison"
                  />
                )}
                {pickupEnabled && (
                  <FulfillmentButton
                    active={fulfillment === 'PICKUP'}
                    onClick={() => setFulfillment('PICKUP')}
                    label="Retrait sur place"
                  />
                )}
              </div>
            </>
          )}

          {fulfillment === 'DELIVERY' && zones.length > 0 && (
            <div className="mt-4">
              <Field label="Zone de livraison" htmlFor="zone" required>
                <select
                  id="zone"
                  value={zoneId ?? ''}
                  onChange={(event) => setZoneId(event.target.value)}
                  className={inputClass}
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} · {formatMoney(zone.fee, currency)}
                      {zone.freeAbove
                        ? ` (offerte dès ${formatMoney(zone.freeAbove, currency)})`
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <p className="mt-3 text-sm text-ink-muted">
            Préparation estimée : environ {prepTimeMinutes} minutes.
          </p>
        </section>

        {/* ------------------------------------------------------ Coordonnées */}
        {step === 'details' && (
          <section aria-label="Vos coordonnées" className="rounded-2xl border border-surface-border p-4">
            <h2 className="text-sm font-medium">Vos coordonnées</h2>

            <form id="checkout-form" onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
              {submitError && (
                <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  {submitError}
                </div>
              )}

              <Field label="Nom complet" htmlFor="customerName" required error={fieldErrors.customerName}>
                <input id="customerName" name="customerName" required autoComplete="name" className={inputClass} />
              </Field>

              <Field
                label="Téléphone"
                htmlFor="customerPhone"
                required
                hint="Le restaurant vous contactera à ce numéro."
                error={fieldErrors.customerPhone}
              >
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  required
                  autoComplete="tel"
                  className={inputClass}
                />
              </Field>

              <Field label="Email (facultatif)" htmlFor="customerEmail" error={fieldErrors.customerEmail}>
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                />
              </Field>

              {fulfillment === 'DELIVERY' && (
                <Field
                  label="Adresse de livraison"
                  htmlFor="deliveryAddress"
                  required
                  error={fieldErrors.deliveryAddress}
                >
                  <textarea
                    id="deliveryAddress"
                    name="deliveryAddress"
                    required
                    rows={2}
                    autoComplete="street-address"
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="Instructions (facultatif)" htmlFor="instructions">
                <textarea
                  id="instructions"
                  name="instructions"
                  rows={2}
                  placeholder="Étage, code, précisions…"
                  className={inputClass}
                />
              </Field>

              <fieldset>
                <legend className="text-sm font-medium">Moyen de paiement</legend>
                {providers.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Aucun moyen de paiement n&apos;est disponible actuellement.
                    Contactez le restaurant directement.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {providers.map((provider) => (
                      <label
                        key={provider.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-border px-4 py-3 text-sm hover:border-ink"
                      >
                        <input
                          type="radio"
                          name="paymentProvider"
                          value={provider.id}
                          checked={providerId === provider.id}
                          onChange={() => setProviderId(provider.id)}
                          className="mt-0.5 h-4 w-4 accent-ink"
                        />
                        <span>
                          <span className="block font-medium">{provider.label}</span>
                          <span className="block text-ink-muted">
                            {provider.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </form>
          </section>
        )}
      </div>

      {/* ----------------------------------------------------------- Résumé */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-surface-border p-4">
          <h2 className="text-sm font-medium">Récapitulatif</h2>

          <form onSubmit={applyPromo} className="mt-3 flex gap-2">
            <label htmlFor="promo" className="sr-only">
              Code promo
            </label>
            <input
              id="promo"
              value={promoInput}
              onChange={(event) => setPromoInput(event.target.value)}
              placeholder="Code promo"
              className={inputClass}
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl border border-surface-border px-4 text-sm font-medium hover:bg-surface-sunken"
            >
              Appliquer
            </button>
          </form>
          {promoError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {promoError}
            </p>
          )}

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Sous-total</dt>
              <dd>{formatMoney(quote?.subtotal ?? estimatedSubtotal, currency)}</dd>
            </div>
            {quote && quote.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Remise {quote.promoCode ? `(${quote.promoCode})` : ''}</dt>
                <dd>−{formatMoney(quote.discount, currency)}</dd>
              </div>
            )}
            {fulfillment === 'DELIVERY' && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Livraison</dt>
                <dd>
                  {quote
                    ? quote.deliveryFee === 0
                      ? 'Offerte'
                      : formatMoney(quote.deliveryFee, currency)
                    : '—'}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd aria-live="polite">
                {quoting ? '…' : formatMoney(displayTotal, currency)}
              </dd>
            </div>
          </dl>

          {quoteError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
              {quoteError}
            </p>
          )}

          {belowMinimum && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Montant minimum de commande :{' '}
              {formatMoney(minOrderAmount, currency)}.
            </p>
          )}

          {step === 'cart' ? (
            <button
              type="button"
              onClick={() => setStep('details')}
              disabled={!quote || belowMinimum || quoting}
              className="mt-4 h-12 w-full rounded-xl bg-brand font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continuer
            </button>
          ) : (
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting || !quote || belowMinimum || providers.length === 0}
              className="mt-4 h-12 w-full rounded-xl bg-brand font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Envoi de la commande…' : 'Valider ma commande'}
            </button>
          )}

          <p className="mt-3 text-center text-xs text-ink-faint">
            Le montant final est calculé par le restaurant à la validation.
          </p>
        </div>
      </aside>
    </div>
  );
}

function FulfillmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-xl border px-5 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-surface-border hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}
