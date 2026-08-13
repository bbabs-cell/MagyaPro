import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { EmptyState, PageHeader, LinkButton } from '@/components/ui';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

/**
 * Portefeuille client du restaurant.
 *
 * Il est propre au tenant : le même numéro de téléphone chez deux restaurants
 * correspond à deux fiches distinctes, et aucun restaurant ne voit les clients
 * d'un autre.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { restaurant } = await requireTenant('customers:view');
  const params = await searchParams;

  const query = (params.q ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 30;

  const where = {
    restaurantId: restaurant.id,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${total} client${total > 1 ? 's' : ''} enregistré${total > 1 ? 's' : ''} à partir de vos commandes.`}
      />

      <form method="get" className="mb-5 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher un client
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Nom, téléphone ou email"
          className="w-full rounded-xl border border-surface-border bg-white px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl border border-surface-border bg-white px-4 text-sm font-medium hover:bg-surface-sunken"
        >
          Rechercher
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState
          title={query ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
          description={
            query
              ? 'Essayez avec un autre nom ou numéro de téléphone.'
              : 'Votre fichier client se construit automatiquement à chaque commande reçue.'
          }
          action={
            query ? (
              <LinkButton href="/dashboard/clients" variant="secondary" size="sm">
                Effacer la recherche
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto p-4 sm:p-5">
          <table className="table-stack w-full border-collapse text-sm">
            <caption className="sr-only">Liste des clients du restaurant</caption>
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="py-2 pr-3 font-medium">Client</th>
                <th scope="col" className="py-2 pr-3 font-medium">Contact</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Commandes</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Total dépensé</th>
                <th scope="col" className="py-2 text-right font-medium">Dernière commande</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-surface-border">
                  <td data-label="Client" className="py-3 pr-3 font-medium">
                    {customer.name}
                  </td>
                  <td data-label="Contact" className="py-3 pr-3">
                    <a
                      href={`tel:${customer.phone}`}
                      className="block underline-offset-4 hover:underline"
                    >
                      {customer.phone}
                    </a>
                    {customer.email && (
                      <span className="block text-xs text-ink-faint">
                        {customer.email}
                      </span>
                    )}
                  </td>
                  <td data-label="Commandes" className="py-3 pr-3 text-right">
                    {customer.ordersCount}
                  </td>
                  <td data-label="Total dépensé" className="py-3 pr-3 text-right font-medium">
                    {formatMoney(customer.totalSpent, restaurant.currency)}
                  </td>
                  <td data-label="Dernière commande" className="py-3 text-right text-ink-muted">
                    {customer.lastOrderAt
                      ? customer.lastOrderAt.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <LinkButton
                href={`/dashboard/clients?q=${encodeURIComponent(query)}&page=${page - 1}`}
                variant="secondary"
                size="sm"
              >
                Précédent
              </LinkButton>
            )}
            {page * pageSize < total && (
              <LinkButton
                href={`/dashboard/clients?q=${encodeURIComponent(query)}&page=${page + 1}`}
                variant="secondary"
                size="sm"
              >
                Suivant
              </LinkButton>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
