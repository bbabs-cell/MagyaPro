'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCart } from '@/components/site/cart-context';
import { cx } from '@/components/ui';
import type { MenuProduct } from '@/components/site/templates';

/**
 * Bouton d'ajout rapide, affiché sur chaque carte de plat.
 *
 * Un plat avec variantes ou options ne peut pas être ajouté sans que le
 * client fasse un choix : le bouton devient alors un lien vers sa fiche,
 * comme le reste de la carte. Toujours un élément séparé du `Link` qui
 * enveloppe la carte — un bouton ne peut pas être imbriqué dans un lien.
 */
export function QuickAddButton({
  product,
  className,
  style,
}: {
  product: MenuProduct;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { addLine } = useCart();
  const [added, setAdded] = useState(false);
  const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';

  useEffect(() => {
    if (!added) return;
    const timeout = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timeout);
  }, [added]);

  if (product.hasOptions) {
    return (
      <Link
        href={product.href}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Choisir les options de ${product.name}`}
        className={className}
        style={style}
      >
        + Ajouter
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addLine({
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          variantId: null,
          variantName: null,
          options: [],
          unitPrice: product.price,
          quantity: 1,
        });
        setAdded(true);
      }}
      aria-label={`Ajouter ${product.name} au panier`}
      className={cx(className, unavailable && 'pointer-events-none opacity-50')}
      style={style}
    >
      {added ? 'Ajouté ✓' : '+ Ajouter'}
    </button>
  );
}
