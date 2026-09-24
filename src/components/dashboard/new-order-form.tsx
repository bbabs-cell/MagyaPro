'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney } from '@/lib/money';
import { AlertMessage, Button, Field, inputClass } from '@/components/ui';

/**
 * Prise de commande par le restaurant — au comptoir, ou au téléphone.
 *
 * L'écran est fait pour quelqu'un qui a le client en face ou au bout du fil :
 * la recherche est au premier plan, chaque plat s'ajoute d'un clic, et le
 * total se met à jour à chaque geste. Rien n'est caché derrière une étape.
 *
 * Le total affiché ici n'est qu'une **estimation de courtoisie**, et c'est
 * volontaire : le serveur recalcule tout à partir de la base. Les deux peuvent
 * différer — une remise, un code promo, des frais de zone — et c'est le
 * montant du serveur qui fait foi. Afficher un sous-total aide à annoncer un
 * prix au client sans attendre ; le présenter comme définitif serait mentir.
 */

type Option = { id: string; name: string; priceDelta: number };
type OptionGroup = { id: string; name: string; minSelect: number; maxSelect: number; options: Option[] };
type Variant = { id: string; name: string; price: number };

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  categoryName: string;
  variants: Variant[];
  optionGroups: OptionGroup[];
};

export type DeliveryZoneChoice = { id: string; name: string; fee: number };
export type TableChoice = { id: string; label: string };

/** Une ligne du panier en cours de saisie. */
type Line = {
  key: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  optionIds: string[];
  optionNames: string[];
  unitPrice: number;
  quantity: number;
};

type Fulfillment = 'PICKUP' | 'DINE_IN' | 'DELIVERY';

const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  PICKUP: 'À emporter',
  DINE_IN: 'Sur place',
  DELIVERY: 'Livraison',
};

export function NewOrderForm({
  products,
  zones,
  tables,
  currency,
}: {
  products: MenuProduct[];
  zones: DeliveryZoneChoice[];
  tables: TableChoice[];
  currency: string;
}) {
  const router = useRouter();
  const mutation = useServerMutation();

  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('PICKUP');
  const [tableId, setTableId] = useState('');
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // Le plat en cours de configuration : une carte s'ouvre sous lui quand il
  // porte des déclinaisons ou des suppléments à choisir.
  const [configuring, setConfiguring] = useState<MenuProduct | null>(null);
  const [draftVariant, setDraftVariant] = useState<string | null>(null);
  const [draftOptions, setDraftOptions] = useState<string[]>([]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.categoryName.toLowerCase().includes(needle),
    );
  }, [products, search]);

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const zoneFee = fulfillment === 'DELIVERY' ? (zones.find((z) => z.id === zoneId)?.fee ?? 0) : 0;

  function addLine(product: MenuProduct, variantId: string | null, optionIds: string[]) {
    const variant = product.variants.find((v) => v.id === variantId) ?? null;
    const options = product.optionGroups
      .flatMap((group) => group.options)
      .filter((option) => optionIds.includes(option.id));

    const unitPrice =
      (variant ? variant.price : product.price) +
      options.reduce((sum, option) => sum + option.priceDelta, 0);

    // Deux fois le même plat avec exactement la même configuration : on
    // incrémente plutôt que d'empiler deux lignes identiques, que le cuisinier
    // devrait ensuite additionner de tête.
    const signature = `${product.id}|${variantId ?? ''}|${[...optionIds].sort().join(',')}`;
    setLines((current) => {
      const existing = current.find((line) => line.key === signature);
      if (existing) {
        return current.map((line) =>
          line.key === signature ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          key: signature,
          productId: product.id,
          productName: product.name,
          variantId,
          variantName: variant?.name ?? null,
          optionIds,
          optionNames: options.map((option) => option.name),
          unitPrice,
          quantity: 1,
        },
      ];
    });
    setConfiguring(null);
    setDraftVariant(null);
    setDraftOptions([]);
  }

  function pick(product: MenuProduct) {
    // Sans déclinaison ni supplément, le plat part directement au panier :
    // demander de confirmer un choix inexistant ferait perdre un geste à
    // chaque article.
    if (product.variants.length === 0 && product.optionGroups.length === 0) {
      addLine(product, null, []);
      return;
    }
    setConfiguring(product);
    setDraftVariant(product.variants[0]?.id ?? null);
    setDraftOptions([]);
  }

  function setQuantity(key: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) => (line.key === key ? { ...line, quantity } : line)),
    );
  }

  function submit() {
    mutation.run(
      () =>
        api.post('/api/commandes', {
          items: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            optionIds: line.optionIds,
            quantity: line.quantity,
          })),
          fulfillmentType: fulfillment,
          deliveryZoneId: fulfillment === 'DELIVERY' ? zoneId : null,
          tableId: fulfillment === 'DINE_IN' ? tableId || null : null,
          customerName,
          customerPhone: customerPhone || undefined,
          deliveryAddress: fulfillment === 'DELIVERY' ? deliveryAddress : undefined,
          instructions: instructions || undefined,
          promoCode: promoCode || undefined,
          alreadyPaid,
        }),
      {
        key: 'creation',
        successMessage: 'Commande enregistrée, elle est partie en cuisine.',
        failureMessage: "La commande n'a pas pu être enregistrée.",
        onSuccess: () => router.push('/dashboard/commandes'),
      },
    );
  }

  const phoneRequired = fulfillment === 'DELIVERY';
  const ready =
    lines.length > 0 &&
    customerName.trim().length >= 2 &&
    (!phoneRequired || customerPhone.trim().length >= 6) &&
    (fulfillment !== 'DELIVERY' || deliveryAddress.trim().length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un plat…"
          className={inputClass}
          autoFocus
        />

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-ink-muted">
            Aucun plat ne correspond.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => pick(product)}
                  className="w-full rounded-xl border border-surface-border bg-surface-raised p-3 text-start transition-colors hover:bg-surface-sunken"
                >
                  <span className="block text-sm font-medium">{product.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {product.categoryName}
                  </span>
                  <span className="mt-1 block text-sm">
                    {formatMoney(product.price, currency)}
                    {product.variants.length > 0 && ' · déclinaisons'}
                  </span>
                </button>

                {configuring?.id === product.id && (
                  <div className="mt-2 space-y-3 rounded-xl border border-ink/20 bg-surface p-3">
                    {product.variants.length > 0 && (
                      <Field label="Déclinaison" htmlFor={`variant-${product.id}`}>
                        <select
                          id={`variant-${product.id}`}
                          value={draftVariant ?? ''}
                          onChange={(event) => setDraftVariant(event.target.value)}
                          className={inputClass}
                        >
                          {product.variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.name} — {formatMoney(variant.price, currency)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {product.optionGroups.map((group) => (
                      <fieldset key={group.id}>
                        <legend className="text-xs font-medium text-ink-muted">
                          {group.name}
                        </legend>
                        <div className="mt-1 space-y-1">
                          {group.options.map((option) => (
                            <label key={option.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={draftOptions.includes(option.id)}
                                onChange={(event) =>
                                  setDraftOptions((current) =>
                                    event.target.checked
                                      ? [...current, option.id]
                                      : current.filter((id) => id !== option.id),
                                  )
                                }
                              />
                              {option.name}
                              {option.priceDelta !== 0 && (
                                <span className="text-ink-faint">
                                  {option.priceDelta > 0 ? '+' : ''}
                                  {formatMoney(option.priceDelta, currency)}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addLine(product, draftVariant, draftOptions)}
                      >
                        Ajouter
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfiguring(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <AlertMessage message={mutation.error} />

        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="text-sm font-medium">Commande</h2>

          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Choisissez des plats pour commencer.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lines.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate">{line.productName}</span>
                    {(line.variantName || line.optionNames.length > 0) && (
                      <span className="block truncate text-xs text-ink-faint">
                        {[line.variantName, ...line.optionNames].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Retirer un ${line.productName}`}
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                      className="h-7 w-7 rounded-lg border border-surface-border"
                    >
                      −
                    </button>
                    <span className="w-5 text-center tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Ajouter un ${line.productName}`}
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                      className="h-7 w-7 rounded-lg border border-surface-border"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && (
            <p className="mt-3 border-t border-surface-border pt-3 text-sm">
              <span className="text-ink-muted">Sous-total </span>
              <span className="font-medium">{formatMoney(subtotal + zoneFee, currency)}</span>
              {/* Le serveur recalcule tout : promotions, frais de zone,
                  indisponibilités. Ce chiffre sert à annoncer un prix au
                  client, pas à faire foi. */}
              <span className="mt-0.5 block text-xs text-ink-faint">
                Estimation — le montant définitif est calculé à l’enregistrement.
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-surface-border bg-surface-raised p-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FULFILLMENT_LABELS) as Fulfillment[]).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={fulfillment === type ? 'primary' : 'secondary'}
                onClick={() => setFulfillment(type)}
              >
                {FULFILLMENT_LABELS[type]}
              </Button>
            ))}
          </div>

          {fulfillment === 'DINE_IN' && tables.length > 0 && (
            <Field label="Table" htmlFor="table">
              <select
                id="table"
                value={tableId}
                onChange={(event) => setTableId(event.target.value)}
                className={inputClass}
              >
                <option value="">Sans table</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {fulfillment === 'DELIVERY' && (
            <>
              <Field label="Zone de livraison" htmlFor="zone" required>
                <select
                  id="zone"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  className={inputClass}
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {formatMoney(zone.fee, currency)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Adresse" htmlFor="adresse" required>
                <input
                  id="adresse"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  className={inputClass}
                  placeholder="Quartier, rue, repère"
                />
              </Field>
            </>
          )}

          <Field label="Nom du client" htmlFor="nom" required>
            <input
              id="nom"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className={inputClass}
              placeholder="Awa Koné"
            />
          </Field>

          <Field
            label="Téléphone"
            htmlFor="telephone"
            required={phoneRequired}
            hint={
              phoneRequired
                ? 'Le livreur doit pouvoir joindre le client.'
                : 'Facultatif. Sans numéro, la commande ne rejoint aucune fiche client.'
            }
          >
            <input
              id="telephone"
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className={inputClass}
              placeholder="+221 77 000 00 00"
            />
          </Field>

          <Field label="Note pour la cuisine" htmlFor="instructions">
            <input
              id="instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className={inputClass}
              placeholder="Sans piment, bien cuit…"
            />
          </Field>

          <Field label="Code promo" htmlFor="promo">
            <input
              id="promo"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              className={inputClass}
              placeholder="Facultatif"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alreadyPaid}
              onChange={(event) => setAlreadyPaid(event.target.checked)}
            />
            Le client a déjà payé
          </label>

          <Button
            type="button"
            className="w-full"
            disabled={!ready}
            loading={mutation.isPending('creation')}
            onClick={submit}
          >
            Enregistrer la commande
          </Button>
        </div>
      </aside>
    </div>
  );
}
