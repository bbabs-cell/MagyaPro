'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { cartLineKey, useCart } from '@/components/site-store/cart-context';
import { quantityStep } from '@/lib/boutique/units';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';
import type { VariantAxis } from '@/lib/boutique/variants';

type PublicVariant = {
  id: string;
  price: number;
  attributes: Record<string, string>;
  stock: number;
};

/**
 * Choix de la déclinaison puis ajout au panier.
 *
 * Tant que le visiteur n'a pas choisi une valeur sur chaque axe, il n'y a pas
 * de déclinaison identifiée — donc pas de prix ni de stock à annoncer, et le
 * bouton reste inactif. Une valeur épuisée reste affichée mais barrée : mieux
 * vaut montrer que la taille existe et qu'elle est en rupture que de la faire
 * disparaître.
 */
export function AddToCart({
  product,
  host,
  locale,
}: {
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    unit: string;
    price: number;
    stock: number;
    axes: VariantAxis[];
    variants: PublicVariant[];
  };
  host: string;
  locale: string;
}) {
  const router = useRouter();
  const { addLine, lines } = useCart();
  const dict = getBoutiqueSiteDictionary(locale);
  const step = quantityStep(product.unit);

  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(step);
  const [added, setAdded] = useState(false);

  const hasAxes = product.axes.length > 0;
  const variant = hasAxes
    ? (product.variants.find((candidate) =>
        product.axes.every((axis) => candidate.attributes[axis.name] === chosen[axis.name]),
      ) ?? null)
    : (product.variants[0] ?? null);

  const variantLabel = variant
    ? product.axes
        .map((axis) => variant.attributes[axis.name])
        .filter(Boolean)
        .join(' · ')
    : '';

  const inCart = variant
    ? (lines.find(
        (line) => cartLineKey(line) === cartLineKey({ productId: product.id, variantId: variant.id }),
      )?.quantity ?? 0)
    : 0;
  const remaining = variant ? variant.stock - inCart : 0;

  function handleAdd() {
    if (!variant || remaining <= 0) return;
    addLine(
      {
        productId: product.id,
        variantId: variant.id,
        variantLabel: variantLabel || undefined,
        name: product.name,
        unitPrice: variant.price,
        maxStock: variant.stock,
        unit: product.unit,
        imageUrl: product.imageUrl,
      },
      Math.min(quantity, remaining),
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6">
      {product.axes.map((axis) => (
        <div key={axis.name} className="mb-4">
          <span className="block text-sm font-medium text-gray-900">{axis.name}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const active = chosen[axis.name] === value;
              // Épuisé : aucune déclinaison portant cette valeur n'a de stock.
              const available = product.variants.some(
                (candidate) => candidate.attributes[axis.name] === value && candidate.stock > 0,
              );
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setChosen((current) => ({
                      ...current,
                      [axis.name]: current[axis.name] === value ? '' : value,
                    }))
                  }
                  className={[
                    'rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 text-gray-900 hover:border-gray-500',
                    !available && !active ? 'text-gray-400 line-through' : '',
                  ].join(' ')}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {hasAxes && !variant && (
        <p className="text-sm text-gray-500">
          Choisissez {product.axes.map((axis) => axis.name.toLowerCase()).join(' et ')} pour
          commander.
        </p>
      )}

      {variant && remaining <= 0 && (
        <p className="text-sm text-gray-500">{dict.outOfStock}</p>
      )}

      {variant && remaining > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={step}
            max={remaining}
            step={step}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(step, Number(event.target.value)))}
            aria-label="Quantité"
            className="h-11 w-20 rounded-xl border border-gray-300 px-3 text-center text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex h-11 items-center rounded-xl bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
          >
            {dict.addToCart}
          </button>
          {added && (
            <button
              type="button"
              onClick={() => router.push(`${sitePathBase(host)}/panier`)}
              className="text-sm font-medium text-gray-900 underline underline-offset-2"
            >
              {dict.viewCartArrow}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
