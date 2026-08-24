'use client';

import Link from 'next/link';

import { useCart } from '@/components/site-store/cart-context';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';

export function CartLink({ host, locale }: { host: string; locale: string }) {
  const { lines } = useCart();
  const count = lines.length;
  const dict = getBoutiqueSiteDictionary(locale);

  return (
    <Link
      href={`${sitePathBase(host)}/panier`}
      className="relative flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
        <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
      </svg>
      {dict.cart}
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-xs font-medium text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
