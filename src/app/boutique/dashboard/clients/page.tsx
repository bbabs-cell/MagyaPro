import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { Card, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';
import { CustomersManager } from '@/components/boutique/customers-manager';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

/** Au-delà, la liste devient impraticable et la recherche prend le relais. */
const CUSTOMERS_LIMIT = 200;

/**
 * Fichier client et suivi du crédit.
 *
 * Deux manques : la page chargeait tous les clients de la boutique, sans
 * limite ni recherche — un fichier de plusieurs milliers de fiches partait en
 * entier vers le navigateur à chaque visite — et elle ne totalisait nulle part
 * le crédit en cours.
 *
 * Or « qui me doit de l'argent, et combien en tout » est la question qui fait
 * ouvrir cet écran. Elle demandait de parcourir la liste et d'additionner de
 * tête.
 */
export default async function BoutiqueCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dette?: string }>;
}) {
  const context = await requireStore('customers:view');
  const params = await searchParams;

  const search = params.q?.trim() || undefined;
  const debtorsOnly = params.dette === '1';

  const where = {
    storeId: context.store.id,
    ...(debtorsOnly ? { creditBalance: { gt: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, total, debt] = await Promise.all([
    prisma.storeCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: CUSTOMERS_LIMIT,
      select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      salesCount: true,
      totalSpent: true,
      creditBalance: true,
      creditLimit: true,
      },
    }),
    prisma.storeCustomer.count({ where }),
    // Le crédit en cours porte sur toute la boutique, jamais sur la sélection :
    // ce que l'on doit au commerçant ne dépend pas du filtre affiché.
    prisma.storeCustomer.aggregate({
      where: { storeId: context.store.id, creditBalance: { gt: 0 } },
      _sum: { creditBalance: true },
      _count: true,
    }),
  ]);

  const outstanding = debt._sum.creditBalance ?? 0;

  return (
    <>
      <PageHeader title="Clients" description="Fichier client et suivi du crédit." />

      {outstanding > 0 && (
        <Card className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 p-4 sm:p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Crédit en cours</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-state-warn">
              {formatMoney(outstanding, context.store.currency)}
            </p>
          </div>
          <p className="text-sm text-ink-muted">
            {debt._count} client{debt._count > 1 ? 's' : ''} à relancer
          </p>
        </Card>
      )}

      <Card className="mb-4 p-4 sm:p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium text-ink-muted">Nom ou téléphone</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ''}
              placeholder="Awa, ou 77…"
              className={cx(inputClass, 'mt-1.5')}
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="dette"
              value="1"
              defaultChecked={debtorsOnly}
              className="h-5 w-5 rounded border-surface-border"
            />
            Seulement ceux qui doivent
          </label>
          <button type="submit" className={cx(buttonClass('primary', 'md'), 'shrink-0')}>
            Rechercher
          </button>
          {(search || debtorsOnly) && (
            <a
              href="/boutique/dashboard/clients"
              className="pb-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Tout afficher
            </a>
          )}
        </form>
      </Card>

      {total > CUSTOMERS_LIMIT && (
        <p className="mb-3 text-sm text-ink-muted">
          {total} clients au total, les {CUSTOMERS_LIMIT} plus récents sont affichés. Utilisez la
          recherche pour retrouver les autres.
        </p>
      )}

      <CustomersManager
        initialCustomers={customers}
        currency={context.store.currency}
        canManage={context.permissions.has('customers:manage')}
        canManageCredit={context.permissions.has('credits:manage')}
      />
    </>
  );
}
