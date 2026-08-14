import { NextResponse } from 'next/server';

import { route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

/** Échappe une valeur pour une cellule CSV (RFC 4180). */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const GET = route(async (request) => {
  const { restaurant } = await requireTenant('audit:view');
  const actionFilter = new URL(request.url).searchParams.get('action')?.trim() ?? '';

  const logs = await prisma.auditLog.findMany({
    where: {
      restaurantId: restaurant.id,
      ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const header = ['Date', 'Action', 'Auteur', 'Cible', 'IP', 'Détails'];
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.actorEmail ?? '',
    log.targetType && log.targetId ? `${log.targetType}:${log.targetId}` : '',
    log.ip ?? '',
    JSON.stringify(log.metadata),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="journal-${restaurant.slug}.csv"`,
    },
  });
});
