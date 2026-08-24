import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { tableRequestSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { createNotification } from '@/lib/notifications';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

type Params = { params: Promise<{ token: string }> };

/**
 * Appel serveur ou demande d'addition depuis la table, sans commande.
 *
 * Se traduit par une notification dans le centre d'alertes du restaurant —
 * rien de plus : ni file d'attente, ni accusé automatique, le personnel gère
 * l'appel comme il gère aujourd'hui un client qui lève la main.
 */
export const POST = route(async (request, { params }: Params) => {
  const { token } = await params;
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(tableRequestSchema, await readJson(request));

  await hit(`table-appel:ip:${ip}`, RATE_LIMITS.write);

  const table = await prisma.restaurantTable.findFirst({
    where: { token, restaurant: { status: 'ACTIVE' } },
    select: { id: true, label: true, restaurantId: true },
  });
  if (!table) throw new NotFoundError('Table introuvable.');

  // Limite par IP *et* par table : sans cette seconde clé, des clients
  // partageant le Wi-Fi du restaurant se gêneraient entre eux, tandis qu'un
  // client isolé pourrait solliciter une même table sans limite tant qu'il
  // reste sous le plafond global par IP.
  await hit(`table-appel:table:${table.id}`, RATE_LIMITS.tableCall);

  const entitlements = await getEntitlements(table.restaurantId);
  requireFeature(entitlements, FEATURES.TABLE_SERVICE);

  const isBill = input.type === 'BILL';
  await createNotification({
    restaurantId: table.restaurantId,
    type: isBill ? 'TABLE_BILL_REQUEST' : 'TABLE_CALL',
    title: isBill ? `Addition demandée — ${table.label}` : `Serveur demandé — ${table.label}`,
    body: isBill
      ? `${table.label} demande l'addition.`
      : `${table.label} demande un serveur.`,
    href: '/dashboard/alertes',
    metadata: { tableId: table.id, tableLabel: table.label },
  });

  return ok({ sent: true });
});
