'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney } from '@/lib/money';
import { AlertMessage, Button, Card, Field, cx, inputClass } from '@/components/ui';

/**
 * Prise de commande par le restaurant — au comptoir, ou au téléphone.
 *
 * La disposition est celle de la Caisse Boutique, délibérément : c'est le même
 * geste, fait par la même personne, souvent sur le même comptoir. Deux écrans
 * de saisie qui se ressemblent s'apprennent une fois.
 *
 * Ce que cela règle, et qui était le défaut de la première version : la carte
 * et la commande en cours sont visibles **en même temps**. Sur grand écran, la
 * commande occupe sa propre colonne et défile pour elle-même — ajouter un
 * vingtième plat ne fait plus disparaître le total sous la ligne de flottaison.
 * Sur téléphone, elle devient une feuille ancrée en bas, appelée par une barre
 * qui affiche en permanence ce qu'il y a à encaisser : sans elle, on ajoute des
 * plats sans jamais voir le montant qu'on est en train d'annoncer au client.
 *
 * Le total affiché n'est qu'une **estimation**, et c'est écrit à l'écran : le
 * serveur recalcule tout à partir de la base. Les deux peuvent différer — une
 * promotion, des frais de zone — et c'est le serveur qui fait foi. Afficher un
 * sous-total permet d'annoncer un prix sans attendre ; le présenter comme
 * définitif serait mentir.
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

/** Une ligne de la commande en cours de saisie. */
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

  /** Feuille de commande sur téléphone — voir la barre inférieure. */
  const [sheetOpen, setSheetOpen] = useState(false);

  // Le plat en cours de configuration : ses déclinaisons et suppléments
  // s'ouvrent sous lui, dans un creux et non dans une seconde carte.
  const [configuring, setConfiguring] = useState<string | null>(null);
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

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const zoneFee = fulfillment === 'DELIVERY' ? (zones.find((z) => z.id === zoneId)?.fee ?? 0) : 0;
  const estimate = subtotal + zoneFee;

  function addLine(product: MenuProduct, variantId: string | null, optionIds: string[]) {
    const variant = product.variants.find((v) => v.id === variantId) ?? null;
    const options = product.optionGroups
      .flatMap((group) => group.options)
      .filter((option) => optionIds.includes(option.id));

    const unitPrice =
      (variant ? variant.price : product.price) +
      options.reduce((sum, option) => sum + option.priceDelta, 0);

    // Deux fois le même plat dans la même configuration : on incrémente plutôt
    // que d'empiler deux lignes identiques, que le cuisinier devrait ensuite
    // additionner de tête.
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
    // Sans déclinaison ni supplément, le plat part directement : demander de
    // confirmer un choix inexistant coûterait un geste par article.
    if (product.variants.length === 0 && product.optionGroups.length === 0) {
      addLine(product, null, []);
      return;
    }
    setConfiguring(product.id);
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
      {/* `pb-24` dégage la barre inférieure, qui recouvrirait sinon les
          derniers plats de la carte. */}
      <div className="max-lg:pb-24">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un plat…"
          className={cx(inputClass, 'mb-4')}
          autoFocus
        />

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border px-4 py-8 text-center text-sm text-ink-muted">
            Aucun plat ne correspond à « {search.trim()} ».
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((product) => {
              const open = configuring === product.id;
              const chosen = lines
                .filter((line) => line.productId === product.id)
                .reduce((sum, line) => sum + line.quantity, 0);

              return (
                <div
                  key={product.id}
                  className={cx(
                    'overflow-hidden rounded-xl border bg-surface-raised transition-colors',
                    open ? 'border-ink' : 'border-surface-border',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => pick(product)}
                    style={{ touchAction: 'manipulation' }}
                    className="flex w-full items-start justify-between gap-3 p-3 text-start hover:bg-surface-sunken"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">
                        {product.categoryName}
                        {product.variants.length > 0 && ' · déclinaisons'}
                      </span>
                      <span className="mt-1.5 block text-sm tabular-nums text-ink">
                        {formatMoney(product.price, currency)}
                      </span>
                    </span>

                    {/* Ce qui est déjà dans la commande, lisible sans quitter
                        la carte : au comptoir on ajoute vite, et on se demande
                        aussitôt si on a bien ajouté. */}
                    {chosen > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium tabular-nums text-brand">
                        ×{chosen}
                      </span>
                    )}
                  </button>

                  {open && (
                    /* Un creux et un filet, pas une carte dans une carte. */
                    <div className="space-y-3 border-t border-surface-border bg-surface-sunken p-3">
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
                          <legend className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                            {group.name}
                          </legend>
                          <div className="mt-1.5 space-y-1">
                            {group.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex min-h-11 items-center gap-2 text-sm text-ink"
                              >
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 shrink-0 accent-ink"
                                  checked={draftOptions.includes(option.id)}
                                  onChange={(event) =>
                                    setDraftOptions((current) =>
                                      event.target.checked
                                        ? [...current, option.id]
                                        : current.filter((id) => id !== option.id),
                                    )
                                  }
                                />
                                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                                {option.priceDelta !== 0 && (
                                  <span className="shrink-0 tabular-nums text-ink-muted">
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voile derrière la feuille : un appui à côté referme, geste attendu sur
          téléphone. Absent sur grand écran, où la commande vit dans sa colonne
          et n'a rien à recouvrir. */}
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
          // Sur grand écran, la colonne suit le défilement et se débrouille
          // seule : la carte peut faire trois écrans de haut, le total et le
          // bouton restent atteignables sans remonter.
          'lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto',
          // Sur téléphone, feuille ancrée en bas plutôt qu'un bloc rejeté sous
          // la carte. Le dégagement bas évite que le bouton d'enregistrement
          // passe sous la barre de gestes Android.
          'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[85vh]',
          'max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-b-none',
          'max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]',
          !sheetOpen && 'max-lg:hidden',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">Commande</h2>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            style={{ touchAction: 'manipulation' }}
            className="-mr-2 rounded-lg px-3 py-2 text-sm text-ink-muted lg:hidden"
          >
            Fermer
          </button>
        </div>

        <AlertMessage message={mutation.error} className="mt-3" />

        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Choisissez des plats dans la carte pour commencer.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lines.map((line) => (
              <li key={line.key} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0 pt-2">
                  <span className="block truncate text-ink">{line.productName}</span>
                  {(line.variantName || line.optionNames.length > 0) && (
                    <span className="block truncate text-xs text-ink-faint">
                      {[line.variantName, ...line.optionNames].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <span className="block text-xs tabular-nums text-ink-muted">
                    {formatMoney(line.unitPrice * line.quantity, currency)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Retirer un ${line.productName}`}
                    onClick={() => setQuantity(line.key, line.quantity - 1)}
                    style={{ touchAction: 'manipulation' }}
                    className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken"
                  >
                    −
                  </button>
                  <span className="w-7 text-center tabular-nums text-ink">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Ajouter un ${line.productName}`}
                    onClick={() => setQuantity(line.key, line.quantity + 1)}
                    style={{ touchAction: 'manipulation' }}
                    className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="mt-3 border-t border-surface-border pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink-muted">Sous-total</span>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {formatMoney(estimate, currency)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-faint">
              Estimation — le montant définitif est calculé à l’enregistrement.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3 border-t border-surface-border pt-4">
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
              placeholder="Prénom et nom"
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
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className={inputClass}
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

          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-ink"
              checked={alreadyPaid}
              onChange={(event) => setAlreadyPaid(event.target.checked)}
            />
            Le client a déjà payé
          </label>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!ready}
            loading={mutation.isPending('creation')}
            onClick={submit}
            style={{ touchAction: 'manipulation' }}
          >
            Enregistrer la commande
          </Button>
        </div>
      </Card>

      {/* Barre inférieure sur téléphone : le montant en cours reste sous les
          yeux pendant qu'on parcourt la carte. Sans elle, on ajoute des plats
          sans jamais voir la somme qu'on s'apprête à annoncer.

          Masquée quand la feuille est ouverte : elle ferait doublon avec le
          bouton d'enregistrement qui s'y trouve déjà. */}
      {!sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-raised shadow-elev2 lg:hidden">
          <div className="flex items-center gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">
                {itemCount === 0
                  ? 'Aucun plat'
                  : `${itemCount} plat${itemCount > 1 ? 's' : ''}`}
              </p>
              <p className="truncate text-lg font-semibold tabular-nums text-ink">
                {formatMoney(estimate, currency)}
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
