import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { PageHeader } from '@/components/ui';
import { JournalPurgeButton } from '@/components/dashboard/journal-purge-button';

export const metadata: Metadata = { title: 'Journal' };
export const dynamic = 'force-dynamic';

function renderChanges(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const changes = (metadata as { changes?: Record<string, { from: unknown; to: unknown }> }).changes;
  if (!changes || Object.keys(changes).length === 0) return null;

  return Object.entries(changes)
    .map(([field, { from, to }]) => `${field} : ${JSON.stringify(from)} → ${JSON.stringify(to)}`)
    .join(' · ');
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const context = await requireTenant('audit:view');
  const params = await searchParams;

  const actionFilter = (params.action ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 50;

  const where = {
    restaurantId: context.restaurant.id,
    ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
  };

  const [logs, total, actionGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { restaurantId: context.restaurant.id },
      _count: true,
    }),
  ]);

  const prefixes = [...new Set(actionGroups.map((row) => row.action.split('.')[0]!))].sort();

  return (
    <>
      <PageHeader
        title="Journal"
        description={`${total} entrée${total > 1 ? 's' : ''}. Les mots de passe et jetons ne sont jamais consignés.`}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/journal/export${actionFilter ? `?action=${actionFilter}` : ''}`}
              className="inline-flex h-9 items-center rounded-xl border border-surface-border bg-surface px-3 text-sm hover:bg-surface-sunken"
            >
              Exporter (CSV)
            </a>
            {context.permissions.has('audit:manage') && <JournalPurgeButton />}
          </div>
        }
      />

      <nav aria-label="Filtrer par type d'action" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/dashboard/journal"
          aria-current={actionFilter === '' ? 'true' : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
            actionFilter === '' ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
          }`}
        >
          Tout
        </Link>
        {prefixes.map((prefix) => (
          <Link
            key={prefix}
            href={`/dashboard/journal?action=${prefix}`}
            aria-current={actionFilter === prefix ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
              actionFilter === prefix ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
            }`}
          >
            {prefix}
          </Link>
        ))}
      </nav>

      <div className="card overflow-x-auto p-4 sm:p-5">
        <table className="table-stack w-full border-collapse text-sm">
          <caption className="sr-only">Entrées du journal</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Action</th>
              <th scope="col" className="py-2 pr-3 font-medium">Auteur</th>
              <th scope="col" className="py-2 font-medium">Détails</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-surface-border align-top">
                <td data-label="Date" className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">
                  {log.createdAt.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td data-label="Action" className="py-2.5 pr-3 font-mono text-xs">{log.action}</td>
                <td data-label="Auteur" className="py-2.5 pr-3">{log.actorEmail ?? '—'}</td>
                <td data-label="Détails" className="py-2.5 text-xs text-ink-muted">
                  {renderChanges(log.metadata) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">Aucune entrée pour ce filtre.</p>
        )}
      </div>

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/dashboard/journal?action=${actionFilter}&page=${page - 1}`}
                className="rounded-xl border border-surface-border bg-surface px-4 py-2 hover:bg-surface-sunken"
              >
                Précédent
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={`/dashboard/journal?action=${actionFilter}&page=${page + 1}`}
                className="rounded-xl border border-surface-border bg-surface px-4 py-2 hover:bg-surface-sunken"
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
