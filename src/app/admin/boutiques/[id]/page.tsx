import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { StatusPill } from '@/app/admin/page';
import { BoutiqueAdminActions } from '@/components/admin/boutique-actions';
import { SECTOR_LABELS as BUSINESS_TYPE_LABELS } from '@/lib/boutique/unit-catalogue';

export const metadata: Metadata = { title: 'Fiche boutique' };
export const dynamic = 'force-dynamic';

export default async function AdminBoutiqueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { name: true, email: true, status: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { sales: true, products: true, customers: true } },
    },
  });
  if (!store) notFound();

  const [revenue, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId: store.id, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.sale.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, number: true, total: true, status: true, createdAt: true },
    }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/boutiques"
            className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
          >
            ← Boutiques
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {store.name}
            <StatusPill status={store.status} />
          </h1>
          <p className="mt-1 font-mono text-sm text-white/50">{store.slug}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Type</p>
          <p className="mt-1 text-lg font-semibold">
            {BUSINESS_TYPE_LABELS[store.businessType] ?? store.businessType}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Volume total</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoney(revenue._sum.total ?? 0, store.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Ventes</p>
          <p className="mt-1 text-lg font-semibold">{store._count.sales}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Produits</p>
          <p className="mt-1 text-lg font-semibold">{store._count.products}</p>
        </div>
      </div>

      <section aria-labelledby="actions" className="mt-8">
        <h2 id="actions" className="text-sm font-medium">
          Actions d&apos;administration
        </h2>
        <div className="mt-3 rounded-2xl border border-white/10 p-4">
          <BoutiqueAdminActions
            store={{
              id: store.id,
              name: store.name,
              status: store.status,
              salesCount: store._count.sales,
            }}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium">Équipe</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {store.members.map((member) => (
              <li key={member.id} className="py-3">
                <p className="font-medium">
                  {member.user.name}{' '}
                  <span className="font-normal text-white/40">
                    · {STORE_ROLE_LABELS[member.role]}
                  </span>
                </p>
                <p className="text-sm text-white/50">{member.user.email}</p>
              </li>
            ))}
            {store.members.length === 0 && (
              <li className="py-3 text-sm text-white/50">Aucun membre.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">Ventes récentes</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">n°{sale.number}</p>
                  <p className="text-sm text-white/50">
                    {sale.createdAt.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="font-medium">{formatMoney(sale.total, store.currency)}</span>
              </li>
            ))}
            {recentSales.length === 0 && (
              <li className="py-3 text-sm text-white/50">Aucune vente.</li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}
