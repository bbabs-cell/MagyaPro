import type { Metadata } from 'next';
import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { ORDER_STATUS_LABELS } from '@/lib/orders/service';
import { OrdersBoard } from '@/components/dashboard/orders-board';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Commandes' };
export const dynamic = 'force-dynamic';

const STATUS_FILTERS = [
  'ACTIVE', 'NEW', 'CONFIRMED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'ALL',
] as const;

type Filter = (typeof STATUS_FILTERS)[number];

/**
 * Libellés courts, pour la barre de filtres uniquement.
 *
 * « Livrée — paiement à confirmer » dit la bonne chose sur une commande, où
 * l'information est actionnable. Dans une pastille, ces trente caractères
 * écrasaient les neuf autres filtres. Le sens complet reste sur la commande.
 */
const FILTER_LABELS: Partial<Record<OrderStatus, string>> = {
  DELIVERED: 'Livrée',
};

/** Statuts considérés « en cours » : le filtre par défaut du service. */
const ACTIVE_STATUSES: OrderStatus[] = [
  'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED',
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; page?: string }>;
}) {
  const { restaurant, permissions } = await requireTenant('orders:view');
  const params = await searchParams;

  const filter: Filter = STATUS_FILTERS.includes(params.statut as Filter)
    ? (params.statut as Filter)
    : 'ACTIVE';

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;

  const where = {
    restaurantId: restaurant.id,
    ...(filter === 'ALL'
      ? {}
      : filter === 'ACTIVE'
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: filter as OrderStatus }),
  };

  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        fulfillmentType: true,
        customerName: true,
        customerPhone: true,
        total: true,
        placedAt: true,
        table: { select: { label: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      where: { restaurantId: restaurant.id },
      _count: true,
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((row) => [row.status, row._count]),
  ) as Record<OrderStatus, number>;

  const activeCount = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + (countByStatus[status] ?? 0),
    0,
  );

  // Somme du regroupement, qui porte sur tout le restaurant. `total`, lui, ne
  // compte que le filtre courant : l'employer ici afficherait « Toutes 0 »
  // pendant qu'on consulte un statut vide.
  const allCount = Object.values(countByStatus).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        title="Commandes"
        description={
          filter === 'ACTIVE'
            ? 'Les commandes à traiter, de la plus récente à la plus ancienne.'
            : undefined
        }
        action={
          permissions.has('orders:create') ? (
            <LinkButton href="/dashboard/commandes/nouvelle">
              Nouvelle commande
            </LinkButton>
          ) : undefined
        }
      />

      {/* Les pastilles passent à la ligne au lieu de défiler : sur dix filtres,
          « Toutes » sortait de l'écran par la droite sans que rien ne signale
          qu'il existait une suite. Même choix que les périodes de l'écran
          Statistiques. */}
      <nav aria-label="Filtrer par statut" className="mb-5 flex flex-wrap gap-2">
        {(['ACTIVE', ...ACTIVE_STATUSES, 'COMPLETED', 'CANCELLED', 'ALL'] as Filter[]).map(
          (value) => {
            const label =
              value === 'ACTIVE'
                ? 'En cours'
                : value === 'ALL'
                  ? 'Toutes'
                  : (FILTER_LABELS[value as OrderStatus] ?? ORDER_STATUS_LABELS[value as OrderStatus]);
            const count =
              value === 'ACTIVE'
                ? activeCount
                : value === 'ALL'
                  ? allCount
                  : (countByStatus[value as OrderStatus] ?? 0);
            const active = filter === value;

            return (
              <a
                key={value}
                href={`/dashboard/commandes?statut=${value}`}
                aria-current={active ? 'true' : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {label}
                {/* Le compte est toujours affiché, zéro compris. Il n'apparaissait
                    qu'au-delà de zéro : on ne pouvait donc pas distinguer un
                    statut vide d'un statut non compté, et il fallait cliquer
                    pour découvrir qu'il n'y avait rien. Savoir où est le travail
                    sans cliquer est la raison d'être de cette barre. */}
                <span
                  className={`ms-1.5 tabular-nums ${
                    active ? 'opacity-80' : count > 0 ? 'font-medium text-ink' : 'text-ink-faint'
                  }`}
                >
                  {count}
                </span>
              </a>
            );
          },
        )}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          title={
            filter === 'ACTIVE'
              ? 'Aucune commande en cours'
              : 'Aucune commande pour ce filtre'
          }
          description={
            filter === 'ACTIVE'
              ? 'Les nouvelles commandes de vos clients apparaîtront ici en temps réel.'
              : 'Essayez un autre filtre pour retrouver vos commandes.'
          }
          action={
            filter !== 'ALL' ? (
              <LinkButton href="/dashboard/commandes?statut=ALL" variant="secondary" size="sm">
                Voir toutes les commandes
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <OrdersBoard
          orders={orders.map((order) => ({
            id: order.id,
            number: order.number,
            status: order.status,
            paymentStatus: order.paymentStatus,
            fulfillmentType: order.fulfillmentType,
            tableLabel: order.table?.label ?? null,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: order.total,
            itemCount: order._count.items,
            placedAt: order.placedAt.toISOString(),
          }))}
          currency={restaurant.currency}
          canCancel={permissions.has('orders:cancel')}
          canUpdate={permissions.has('orders:update_status')}
        />
      )}

      {total > pageSize && (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between text-sm"
        >
          <span className="text-ink-muted">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <LinkButton
                href={`/dashboard/commandes?statut=${filter}&page=${page - 1}`}
                variant="secondary"
                size="sm"
              >
                Précédent
              </LinkButton>
            )}
            {page * pageSize < total && (
              <LinkButton
                href={`/dashboard/commandes?statut=${filter}&page=${page + 1}`}
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
