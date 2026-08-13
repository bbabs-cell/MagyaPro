import Link from 'next/link';
import type { Metadata } from 'next';
import type { RestaurantStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { StatusPill } from '@/app/admin/page';

export const metadata: Metadata = { title: 'Restaurants' };
export const dynamic = 'force-dynamic';

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const query = (params.q ?? '').trim();
  const status = ['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(params.statut ?? '')
    ? (params.statut as RestaurantStatus)
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

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        currency: true,
        createdAt: true,
        isDemo: true,
        subscription: { select: { status: true, plan: { select: { name: true } } } },
        _count: { select: { orders: true, products: true, members: true } },
      },
    }),
    prisma.restaurant.count({ where }),
  ]);

  // Volume par restaurant, calculé en une requête groupée plutôt qu'une par
  // ligne — la liste reste rapide même avec plusieurs milliers de tenants.
  const revenues = await prisma.order.groupBy({
    by: ['restaurantId'],
    where: {
      restaurantId: { in: restaurants.map((restaurant) => restaurant.id) },
      status: { not: 'CANCELLED' },
    },
    _sum: { total: true },
  });
  const revenueByRestaurant = new Map(
    revenues.map((row) => [row.restaurantId, row._sum.total ?? 0]),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
      <p className="mt-1 text-sm text-white/60">
        {total} restaurant{total > 1 ? 's' : ''} sur la plateforme.
      </p>

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher un restaurant
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

      {restaurants.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/20 p-10 text-center text-sm text-white/60">
          Aucun restaurant ne correspond à ces critères.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="table-stack w-full border-collapse text-sm">
            <caption className="sr-only">Restaurants de la plateforme</caption>
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th scope="col" className="py-2 pr-3 font-medium">Restaurant</th>
                <th scope="col" className="py-2 pr-3 font-medium">Abonnement</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Commandes</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Volume</th>
                <th scope="col" className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((restaurant) => (
                <tr key={restaurant.id} className="border-b border-white/10">
                  <td data-label="Restaurant" className="py-3 pr-3">
                    <Link
                      href={`/admin/restaurants/${restaurant.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {restaurant.name}
                    </Link>
                    <span className="block text-xs text-white/40">
                      {restaurant.slug}
                      {restaurant.isDemo && ' · démo'}
                      {' · '}
                      {restaurant._count.products} plat
                      {restaurant._count.products > 1 ? 's' : ''}
                      {' · '}
                      {restaurant._count.members} membre
                      {restaurant._count.members > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td data-label="Abonnement" className="py-3 pr-3 text-white/70">
                    {restaurant.subscription
                      ? `${restaurant.subscription.plan.name} · ${restaurant.subscription.status}`
                      : 'Aucun'}
                  </td>
                  <td data-label="Commandes" className="py-3 pr-3 text-right">
                    {restaurant._count.orders}
                  </td>
                  <td data-label="Volume" className="py-3 pr-3 text-right">
                    {formatMoney(
                      revenueByRestaurant.get(restaurant.id) ?? 0,
                      restaurant.currency,
                    )}
                  </td>
                  <td data-label="Statut" className="py-3">
                    <StatusPill status={restaurant.status} />
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
                href={`/admin/restaurants?q=${encodeURIComponent(query)}&statut=${status ?? ''}&page=${page - 1}`}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Précédent
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={`/admin/restaurants?q=${encodeURIComponent(query)}&statut=${status ?? ''}&page=${page + 1}`}
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
