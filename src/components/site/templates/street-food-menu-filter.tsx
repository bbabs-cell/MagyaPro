'use client';

import { useState } from 'react';
import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';
import { QuickAddButton } from '@/components/site/quick-add-button';
import type { MenuCategoryData } from '@/components/site/templates';

const BADGE_LABELS: Record<string, string> = {
  POPULAR: 'Populaire',
  NEW: 'Nouveau',
  PROMOTION: 'Promo',
  SOLD_OUT: 'Épuisé',
};

/**
 * Grille de plats filtrable par catégorie, à la manière d'une carte de
 * restauration rapide moderne (boutons de filtre + cartes contour épais).
 * Client Component : le filtrage est instantané, sans aller-retour serveur.
 */
export function StreetFoodMenuFilter({
  categories,
  currency,
}: {
  categories: MenuCategoryData[];
  currency: string;
}) {
  const [active, setActive] = useState<string>('all');

  const visible =
    active === 'all' ? categories : categories.filter((category) => category.id === active);

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActive('all')}
            className={cx(
              'rounded-full border-2 border-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              active === 'all' ? 'bg-ink text-surface' : 'text-ink hover:bg-surface-sunken',
            )}
          >
            Tout
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActive(category.id)}
              className={cx(
                'rounded-full border-2 border-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                active === category.id ? 'bg-ink text-surface' : 'text-ink hover:bg-surface-sunken',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-14">
        {visible.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`cat-${category.id}`}>
            {active === 'all' && (
              <h3 id={`cat-${category.id}`} className="font-display text-2xl font-semibold">
                {category.name}
              </h3>
            )}
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product) => {
                const unavailable = !product.isAvailable || product.badge === 'SOLD_OUT';
                return (
                  <div
                    key={product.id}
                    className={cx(
                      'group relative overflow-hidden rounded-3xl border-2 border-ink bg-surface transition-transform hover:-translate-y-1',
                      unavailable && 'opacity-60',
                    )}
                  >
                    <Link href={product.href} aria-disabled={unavailable || undefined}>
                      <div className="relative aspect-square overflow-hidden bg-surface-sunken">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image de tenant
                          <img
                            src={product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : null}
                        {product.badge !== 'NONE' && BADGE_LABELS[product.badge] && (
                          <span
                            className="absolute left-2 top-2 -rotate-3 rounded-full px-2.5 py-1 text-xs font-bold uppercase text-white"
                            style={{ backgroundColor: 'var(--brand)' }}
                          >
                            {BADGE_LABELS[product.badge]}
                          </span>
                        )}
                        <span className="absolute -bottom-3 right-3 rotate-2 rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black text-black shadow-[3px_3px_0_rgba(0,0,0,0.15)]">
                          {formatMoney(product.price, currency)}
                        </span>
                      </div>
                      <div className="p-4 pb-3 pt-6">
                        <h4 className="font-black uppercase leading-snug">{product.name}</h4>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{product.description}</p>
                        )}
                        {unavailable && <p className="mt-1 text-xs text-ink-faint">Indisponible</p>}
                      </div>
                    </Link>
                    <div className="px-4 pb-4">
                      <QuickAddButton
                        product={product}
                        className="flex h-9 w-full items-center justify-center rounded-full text-xs font-black uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: 'var(--brand)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
