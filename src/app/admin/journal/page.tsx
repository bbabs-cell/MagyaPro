import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = 'force-dynamic';

/**
 * Journal d'audit de la plateforme.
 *
 * Il consigne les actions sensibles, y compris — et surtout — celles des
 * administrateurs eux-mêmes : accès support, suspensions, suppressions. Cette
 * page est en lecture seule ; aucune entrée n'est modifiable ni effaçable
 * depuis l'interface.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const actionFilter = (params.action ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 50;

  const where = actionFilter ? { action: { startsWith: actionFilter } } : {};

  const [logs, total, actionGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { restaurant: { select: { name: true, slug: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { action: 'asc' } }),
  ]);

  // Regroupement par préfixe (« order », « support », …) pour un filtre lisible.
  const prefixes = [
    ...new Set(actionGroups.map((row) => row.action.split('.')[0]!)),
  ].sort();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Journal d&apos;audit</h1>
      <p className="mt-1 text-sm text-white/60">
        {total} entrée{total > 1 ? 's' : ''}. Les données sensibles (mots de
        passe, jetons) ne sont jamais consignées.
      </p>

      <nav aria-label="Filtrer par type d'action" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/admin/journal"
          aria-current={actionFilter === '' ? 'true' : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
            actionFilter === '' ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          Tout
        </Link>
        {prefixes.map((prefix) => (
          <Link
            key={prefix}
            href={`/admin/journal?action=${prefix}`}
            aria-current={actionFilter === prefix ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
              actionFilter === prefix ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10'
            }`}
          >
            {prefix}
          </Link>
        ))}
      </nav>

      <div className="mt-6 overflow-x-auto">
        <table className="table-stack w-full border-collapse text-sm">
          <caption className="sr-only">Entrées du journal d&apos;audit</caption>
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Action</th>
              <th scope="col" className="py-2 pr-3 font-medium">Auteur</th>
              <th scope="col" className="py-2 pr-3 font-medium">Restaurant</th>
              <th scope="col" className="py-2 font-medium">Détails</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-white/10 align-top">
                <td data-label="Date" className="whitespace-nowrap py-3 pr-3 text-white/60">
                  {log.createdAt.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td data-label="Action" className="py-3 pr-3">
                  <span className="font-mono text-xs">{log.action}</span>
                </td>
                <td data-label="Auteur" className="py-3 pr-3 text-white/70">
                  {log.actorEmail ?? '—'}
                  {log.ip && (
                    <span className="block font-mono text-xs text-white/30">{log.ip}</span>
                  )}
                </td>
                <td data-label="Restaurant" className="py-3 pr-3 text-white/70">
                  {log.restaurant?.name ?? '—'}
                </td>
                <td data-label="Détails" className="py-3">
                  <span className="block max-w-md break-words font-mono text-xs text-white/50">
                    {JSON.stringify(log.metadata)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-white/60">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/journal?action=${actionFilter}&page=${page - 1}`}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Précédent
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={`/admin/journal?action=${actionFilter}&page=${page + 1}`}
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
