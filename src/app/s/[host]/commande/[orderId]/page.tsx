import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { formatMoney } from '@/lib/money';
import { formatQty } from '@/lib/boutique/quantity';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';

export const metadata: Metadata = { title: 'Commande' };

/**
 * Confirmation/statut d'une commande — aucune authentification, protégée
 * uniquement par l'identifiant non énumérable de la commande (cuid) filtré
 * par boutique, comme la page équivalente Restaurant.
 */
export default async function StoreOrderStatusPage({
  params,
}: {
  params: Promise<{ host: string; orderId: string }>;
}) {
  const { host, orderId } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, storeId: store.id },
    include: { items: true },
  });
  if (!order) notFound();

  const dict = getBoutiqueSiteDictionary(store.language);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.orderNumber(order.number)}</h1>
      <p className="mt-1 text-sm text-gray-600">{dict.orderStatus[order.status] ?? order.status}</p>

      <div className="mt-6 rounded-2xl border border-gray-200 p-5">
        <ul className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2.5 text-sm">
              <span>
                {formatQty(item.quantity)} × {item.productName}
              </span>
              <span>{formatMoney(item.total, order.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-base font-semibold">
          <span>{dict.total}</span>
          <span>{formatMoney(order.total, order.currency)}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-600">{dict.pickupAt(store.name, store.addressLine)}</p>

      <Link
        href={`${sitePathBase(host)}/produits`}
        className="mt-6 inline-flex h-11 items-center rounded-xl border border-gray-300 px-6 text-sm font-medium hover:bg-gray-50"
      >
        {dict.continueShopping}
      </Link>
    </div>
  );
}
