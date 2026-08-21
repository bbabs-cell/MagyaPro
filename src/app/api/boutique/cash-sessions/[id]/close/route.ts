import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { closeCashSessionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

/**
 * Fermeture de caisse — calcule le solde théorique à partir du fond de
 * caisse initial, des ventes en espèces rattachées à cette session et des
 * mouvements manuels (dépôts, retraits), puis compare au comptage réel de
 * l'utilisateur. L'écart est conservé tel quel, jamais recalculé après
 * coup : c'est la trace de ce qui a été constaté ce jour-là.
 */
export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('cash:manage');
  const { id } = await params;

  const session = await prisma.cashSession.findFirst({
    where: { id, storeId: context.store.id },
    include: {
      movements: true,
      sales: { include: { payments: true } },
    },
  });
  if (!session) throw new NotFoundError('Session de caisse introuvable.');
  if (session.status === 'CLOSED') {
    throw new ValidationError('Cette session est déjà fermée.');
  }

  const input = parseOrThrow(closeCashSessionSchema, await readJson(request));

  const cashSales = session.sales.reduce(
    (sum, sale) =>
      sum + sale.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
    0,
  );
  const deposits = session.movements
    .filter((m) => m.type === 'DEPOSIT')
    .reduce((sum, m) => sum + m.amount, 0);
  const withdrawals = session.movements
    .filter((m) => m.type === 'WITHDRAWAL' || m.type === 'EXPENSE')
    .reduce((sum, m) => sum + m.amount, 0);

  const expectedBalance = session.openingBalance + cashSales + deposits - withdrawals;
  const difference = input.countedBalance - expectedBalance;

  const closed = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      expectedBalance,
      countedBalance: input.countedBalance,
      difference,
      closedAt: new Date(),
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CASH_SESSION_CLOSED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'cash_session',
    targetId: session.id,
    metadata: { expectedBalance, countedBalance: input.countedBalance, difference },
  });

  return ok({ session: closed });
});
