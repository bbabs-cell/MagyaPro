import { NextResponse } from 'next/server';

import { route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

const EXPORT_LIMIT = 20_000;

/**
 * Échappe une valeur pour une cellule CSV (RFC 4180), et neutralise les
 * formules : un contenu saisi par un client ou un employé (nom de
 * restaurant, note) ne doit jamais s'exécuter comme une formule dans le
 * tableur de la personne qui ouvre l'export.
 */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const GET = route(async (request) => {
  const { restaurant } = await requireTenant('audit:view');
  const actionFilter = new URL(request.url).searchParams.get('action')?.trim() ?? '';

  const where = {
    restaurantId: restaurant.id,
    ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: EXPORT_LIMIT }),
  ]);

  const header = ['Date', 'Action', 'Auteur', 'Cible', 'IP', 'Détails'];
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.actorEmail ?? '',
    log.targetType && log.targetId ? `${log.targetType}:${log.targetId}` : '',
    log.ip ?? '',
    JSON.stringify(log.metadata),
  ]);

  // Un export tronqué ne doit jamais passer pour complet : la ligne finale le
  // dit explicitement, en particulier avant une purge.
  if (total > logs.length) {
    rows.push([
      '',
      'EXPORT_TRONQUE',
      '',
      '',
      '',
      `${logs.length} entrée(s) exportée(s) sur ${total} — seules les plus récentes sont incluses.`,
    ]);
  }

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="journal-${restaurant.slug}.csv"`,
    },
  });
});
