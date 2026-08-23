'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCart } from '@/components/site-store/cart-context';
import { quantityStep } from '@/lib/boutique/units';

export function AddToCart({
  product,
  host,
}: {
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    unit: string;
    price: number;
    stock: number;
  };
  host: string;
}) {
  const router = useRouter();
  const { addLine, lines } = useCart();
  const step = quantityStep(product.unit);
  const inCart = lines.find((l) => l.productId === product.id)?.quantity ?? 0;
  const [quantity, setQuantity] = useState(step);
  const [added, setAdded] = useState(false);

  const remaining = product.stock - inCart;
  if (remaining <= 0) return null;

  function handleAdd() {
    addLine(
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        maxStock: product.stock,
        unit: product.unit,
        imageUrl: product.imageUrl,
      },
      quantity,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <input
        type="number"
        min={step}
        max={remaining}
        step={step}
        value={quantity}
        onChange={(event) => setQuantity(Math.max(step, Number(event.target.value)))}
        className="h-11 w-20 rounded-xl border border-gray-300 px-3 text-center text-sm focus:border-gray-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex h-11 items-center rounded-xl bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
      >
        Ajouter au panier
      </button>
      {added && (
        <button
          type="button"
          onClick={() => router.push(`/s/${host}/panier`)}
          className="text-sm font-medium text-gray-900 underline underline-offset-2"
        >
          Voir le panier →
        </button>
      )}
    </div>
  );
}
