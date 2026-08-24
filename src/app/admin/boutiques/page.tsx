import Link from 'next/link';
import type { Metadata } from 'next';
import type { StoreStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { StatusPill } from '@/app/admin/page';
import { BoutiqueDemoPanel } from '@/components/admin/boutique-demo-panel';

export const metadata: Metadata = { title: 'Boutiques' };
export const dynamic = 'force-dynamic';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  CLOTHING: 'Habillement',
  ELECTRONICS: 'Électronique',
  COSMETICS: 'Cosmétique',
  GROCERY: 'Alimentation',
  OTHER: 'Autre',
};

export default async function AdminBoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const query = (params.q ?? '').trim();
  const status = ['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(params.statut ?? '')
    ? (params.statut as StoreStatus)
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;

  const where = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { slug: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        businessType: true,
        currency: true,
        createdAt: true,
        _count: { select: { sales: true, products: true, members: true } },
      },
    }),
    prisma.store.count({ where }),
  ]);

  // Volume par boutique, calculé en une requête groupée plutôt qu'une par
  // ligne — même principe que la liste des restaurants.
  const revenues = await prisma.sale.groupBy({
    by: ['storeId'],
    where: { storeId: { in: stores.map((store) => store.id) }, status: { not: 'CANCELLED' } },
    _sum: { total: true },
  });
  const revenueByStore = new Map(revenues.map((row) => [row.storeId, row._sum.total ?? 0]));
  const demoCount = await prisma.store.count({ where: { isDemo: true } });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Boutiques</h1>
      <p className="mt-1 text-sm text-white/60">
        {total} boutique{total > 1 ? 's' : ''} MagyaPro Boutique sur la plateforme.
      </p>

      <BoutiqueDemoPanel demoCount={demoCount} />

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher une boutique
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Nom, adresse ou email"
          className="min-w-52 flex-1 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40"
        />
        <label htmlFor="statut" className="sr-only">
          Filtrer par statut
        </label>
        <select
          id="statut"
          name="statut"
          defaultValue={status ?? ''}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
        >
          <option value="" className="text-ink">Tous les statuts</option>
          <option value="ACTIVE" className="text-ink">En ligne</option>
          <option value="DRAFT" className="text-ink">Brouillon</option>
          <option value="SUSPENDED" className="text-ink">Suspendu</option>
        </select>
        <button
          type="submit"
          className="h-11 rounded-xl bg-white px-4 text-sm font-medium text-ink hover:bg-white/90"
        >
          Filtrer
        </button>
      </form>

      {stores.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/20 p-10 text-center text-sm text-white/60">
          Aucune boutique ne correspond à ces critères.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="table-stack w-full border-collapse text-sm">
            <caption className="sr-only">Boutiques de la plateforme</caption>
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th scope="col" className="py-2 pr-3 font-medium">Boutique</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Ventes</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Volume</th>
                <th scope="col" className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-b border-white/10">
                  <td data-label="Boutique" className="py-3 pr-3">
                    <Link
                      href={`/admin/boutiques/${store.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {store.name}
                    </Link>
                    <span className="block text-xs text-white/40">
                      {store.slug}
                      {' · '}
                      {store._count.products} produit{store._count.products > 1 ? 's' : ''}
                      {' · '}
                      {store._count.members} membre{store._count.members > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td data-label="Type" className="py-3 pr-3 text-white/70">
                    {BUSINESS_TYPE_LABELS[store.businessType] ?? store.businessType}
                  </td>
                  <td data-label="Ventes" className="py-3 pr-3 text-right">
                    {store._count.sales}
                  </td>
                  <td data-label="Volume" className="py-3 pr-3 text-right">
                    {formatMoney(revenueByStore.get(store.id) ?? 0, store.currency)}
                  </td>
                  <td data-label="Statut" className="py-3">
                    <StatusPill status={store.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-white/60">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/boutiques?q=${encodeURIComponent(query)}&statut=${status ?? ''}&page=${page - 1}`}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Précédent
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={`/admin/boutiques?q=${encodeURIComponent(query)}&statut=${status ?? ''}&page=${page + 1}`}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Suivant
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
