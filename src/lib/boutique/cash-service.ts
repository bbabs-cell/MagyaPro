import { prisma } from '@/lib/db';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * Ouverture/fermeture de caisse — extrait des routes pour être testable
 * directement, même principe que `sales-service.ts`.
 */

/**
 * Une seule session ouverte à la fois par boutique dans cette première
 * version (pas encore de caisses multiples simultanées) — l'ouverture
 * échoue explicitement si une session est déjà en cours, plutôt que d'en
 * ouvrir une seconde en silence.
 */
export async function openCashSession(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  openingBalance: number;
}) {
  const { storeId, userId, userEmail, openingBalance } = params;

  const alreadyOpen = await prisma.cashSession.findFirst({ where: { storeId, status: 'OPEN' } });
  if (alreadyOpen) {
    throw new ValidationError('Une session de caisse est déjà ouverte.');
  }

  // La caisse principale est créée à l'inscription ; ce filet de sécurité
  // couvre les comptes créés avant l'introduction de cette fonctionnalité.
  let register = await prisma.cashRegister.findFirst({ where: { storeId, isActive: true } });
  if (!register) {
    register = await prisma.cashRegister.create({ data: { storeId, name: 'Caisse principale' } });
  }

  const session = await prisma.cashSession.create({
    data: { storeId, cashRegisterId: register.id, userId, openingBalance },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CASH_SESSION_OPENED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'cash_session',
    targetId: session.id,
    metadata: { openingBalance },
  });

  return session;
}

/**
 * Calcule le solde théorique à partir du fond de caisse initial, des ventes
 * en espèces rattachées à cette session et des mouvements manuels (dépôts,
 * retraits), puis compare au comptage réel de l'utilisateur. L'écart est
 * conservé tel quel, jamais recalculé après coup : c'est la trace de ce qui
 * a été constaté ce jour-là.
 */
export async function closeCashSession(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  sessionId: string;
  countedBalance: number;
}) {
  const { storeId, userId, userEmail, sessionId, countedBalance } = params;

  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, storeId },
    include: { movements: true, sales: { include: { payments: true } } },
  });
  if (!session) throw new NotFoundError('Session de caisse introuvable.');
  if (session.status === 'CLOSED') {
    throw new ValidationError('Cette session est déjà fermée.');
  }

  const cashSales = session.sales.reduce(
    (sum, sale) => sum + sale.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
    0,
  );
  const deposits = session.movements
    .filter((m) => m.type === 'DEPOSIT')
    .reduce((sum, m) => sum + m.amount, 0);
  const withdrawals = session.movements
    .filter((m) => m.type === 'WITHDRAWAL' || m.type === 'EXPENSE')
    .reduce((sum, m) => sum + m.amount, 0);

  const expectedBalance = session.openingBalance + cashSales + deposits - withdrawals;
  const difference = countedBalance - expectedBalance;

  const closed = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      expectedBalance,
      countedBalance,
      difference,
      closedAt: new Date(),
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CASH_SESSION_CLOSED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'cash_session',
    targetId: session.id,
    metadata: { expectedBalance, countedBalance, difference },
  });

  return closed;
}
