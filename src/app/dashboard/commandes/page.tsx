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
  'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'ALL',
] as const;

type Filter = (typeof STATUS_FILTERS)[number];

/** Statuts considérés « en cours » : le filtre par défaut du service. */
const ACTIVE_STATUSES: OrderStatus[] = [
  'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY',
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

  return (
    <>
      <PageHeader
        title="Commandes"
        description={
          filter === 'ACTIVE'
            ? 'Les commandes à traiter, de la plus récente à la plus ancienne.'
            : undefined
        }
      />

      <nav aria-label="Filtrer par statut" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(['ACTIVE', ...ACTIVE_STATUSES, 'COMPLETED', 'CANCELLED', 'ALL'] as Filter[]).map(
          (value) => {
            const label =
              value === 'ACTIVE'
                ? 'En cours'
                : value === 'ALL'
                  ? 'Toutes'
                  : ORDER_STATUS_LABELS[value as OrderStatus];
            const count =
              value === 'ACTIVE'
                ? activeCount
                : value === 'ALL'
                  ? undefined
                  : (countByStatus[value as OrderStatus] ?? 0);

            return (
              <a
                key={value}
                href={`/dashboard/commandes?statut=${value}`}
                aria-current={filter === value ? 'true' : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  filter === value
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink-muted hover:text-ink'
                }`}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 opacity-70">{count}</span>
                )}
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
