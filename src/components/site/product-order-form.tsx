'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatMoney } from '@/lib/money';
import { useCart } from '@/components/site/cart-context';

/**
 * Composition d'un article et ajout au panier.
 *
 * Le prix affiché ici est une estimation calculée dans le navigateur pour que
 * le client voie le montant évoluer en direct. Il n'est jamais envoyé au
 * serveur : au moment de la commande, seuls les identifiants partent, et le
 * serveur recalcule le total à partir de la base.
 */

type Option = { id: string; name: string; priceDelta: number };
type OptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Option[];
};

type ProductData = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  isAvailable: boolean;
  variants: Array<{ id: string; name: string; price: number }>;
  optionGroups: OptionGroup[];
};

export function ProductOrderForm({
  product,
  currency,
  host,
  orderingEnabled,
}: {
  product: ProductData;
  currency: string;
  host: string;
  orderingEnabled: boolean;
}) {
  const router = useRouter();
  const { addLine } = useCart();

  const [variantId, setVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const unitPrice = useMemo(() => {
    const variant = product.variants.find((v) => v.id === variantId);
    let price = variant ? variant.price : product.price;

    for (const group of product.optionGroups) {
      for (const optionId of selected[group.id] ?? []) {
        const option = group.options.find((o) => o.id === optionId);
        if (option) price += option.priceDelta;
      }
    }
    return Math.max(0, price);
  }, [product, variantId, selected]);

  function toggleOption(group: OptionGroup, optionId: string) {
    setError(null);
    setAdded(false);

    setSelected((current) => {
      const chosen = current[group.id] ?? [];

      if (chosen.includes(optionId)) {
        return { ...current, [group.id]: chosen.filter((id) => id !== optionId) };
      }

      // Un groupe à choix unique remplace la sélection ; un groupe multiple
      // refuse silencieusement au-delà du maximum plutôt que d'échanger un
      // choix que le client n'a pas désigné.
      if (group.maxSelect === 1) {
        return { ...current, [group.id]: [optionId] };
      }
      if (chosen.length >= group.maxSelect) return current;

      return { ...current, [group.id]: [...chosen, optionId] };
    });
  }

  function handleAdd(goToCart: boolean) {
    // Les mêmes règles sont revérifiées côté serveur ; ce contrôle sert à
    // afficher l'erreur immédiatement plutôt qu'après un aller-retour.
    for (const group of product.optionGroups) {
      const chosen = selected[group.id] ?? [];
      if (chosen.length < group.minSelect) {
        setError(
          `Choisissez ${group.minSelect === 1 ? 'une option' : `au moins ${group.minSelect} options`} dans « ${group.name} ».`,
        );
        return;
      }
    }

    const options = product.optionGroups.flatMap((group) =>
      (selected[group.id] ?? []).map((optionId) => {
        const option = group.options.find((o) => o.id === optionId)!;
        return {
          id: option.id,
          groupName: group.name,
          name: option.name,
          priceDelta: option.priceDelta,
        };
      }),
    );

    const variant = product.variants.find((v) => v.id === variantId);

    addLine({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      options,
      unitPrice,
      quantity,
    });

    if (goToCart) {
      router.push(`/r/${host}/panier`);
    } else {
      setAdded(true);
    }
  }

  if (!product.isAvailable) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-sunken p-5">
        <p className="font-medium">Ce plat est actuellement indisponible.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Revenez plus tard ou découvrez le reste de la carte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-2xl font-semibold">
        {formatMoney(unitPrice, currency)}
        {product.compareAtPrice && (
          <span className="ml-3 text-base font-normal text-ink-faint line-through">
            {formatMoney(product.compareAtPrice, currency)}
          </span>
        )}
      </p>

      {product.variants.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">Taille</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <label
                key={variant.id}
                className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  variantId === variant.id
                    ? 'border-ink bg-ink text-white'
                    : 'border-surface-border hover:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={variant.id}
                  checked={variantId === variant.id}
                  onChange={() => {
                    setVariantId(variant.id);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                {variant.name} · {formatMoney(variant.price, currency)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {product.optionGroups.map((group) => {
        const chosen = selected[group.id] ?? [];
        const isSingle = group.maxSelect === 1;

        return (
          <fieldset key={group.id}>
            <legend className="text-sm font-medium">
              {group.name}
              <span className="ml-2 font-normal text-ink-faint">
                {group.minSelect > 0
                  ? `${group.minSelect === group.maxSelect ? 'Choisissez' : 'Au moins'} ${group.minSelect}`
                  : 'Facultatif'}
                {group.maxSelect > 1 && ` · jusqu'à ${group.maxSelect}`}
              </span>
            </legend>

            <div className="mt-2 space-y-1.5">
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3 text-sm hover:border-ink"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type={isSingle ? 'radio' : 'checkbox'}
                      name={`group-${group.id}`}
                      checked={chosen.includes(option.id)}
                      onChange={() => toggleOption(group, option.id)}
                      className="h-4 w-4 accent-ink"
                    />
                    {option.name}
                  </span>
                  {option.priceDelta !== 0 && (
                    <span className="text-ink-muted">
                      {option.priceDelta > 0 ? '+' : '−'}
                      {formatMoney(Math.abs(option.priceDelta), currency)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {orderingEnabled ? (
        <>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Quantité</span>
            <div className="inline-flex items-center rounded-xl border border-surface-border">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-11 w-11 text-lg hover:bg-surface-sunken"
                aria-label="Diminuer la quantité"
              >
                −
              </button>
              <span aria-live="polite" className="w-10 text-center text-sm font-medium">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="h-11 w-11 text-lg hover:bg-surface-sunken"
                aria-label="Augmenter la quantité"
              >
                +
              </button>
            </div>
          </div>

          {added && (
            <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Ajouté au panier.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => handleAdd(false)}
              className="h-12 flex-1 rounded-xl border border-surface-border font-medium hover:bg-surface-sunken"
            >
              Ajouter au panier
            </button>
            <button
              type="button"
              onClick={() => handleAdd(true)}
              className="h-12 flex-1 rounded-xl bg-brand font-medium text-white transition-opacity hover:opacity-90"
            >
              Commander · {formatMoney(unitPrice * quantity, currency)}
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-muted">
          Les commandes en ligne sont temporairement fermées.
        </p>
      )}
    </div>
  );
}
