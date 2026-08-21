import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { openCashSessionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ValidationError } from '@/lib/errors';

/**
 * Ouverture de caisse. Une seule session ouverte à la fois par boutique
 * dans cette première version (pas encore de caisses multiples
 * simultanées) — l'ouverture échoue explicitement si une session est déjà
 * en cours, plutôt que d'en ouvrir une seconde en silence.
 */
export const POST = route(async (request) => {
  const context = await requireStore('cash:manage');

  const alreadyOpen = await prisma.cashSession.findFirst({
    where: { storeId: context.store.id, status: 'OPEN' },
  });
  if (alreadyOpen) {
    throw new ValidationError('Une session de caisse est déjà ouverte.');
  }

  const input = parseOrThrow(openCashSessionSchema, await readJson(request));

  // La caisse principale est créée à l'inscription ; ce filet de sécurité
  // couvre les comptes créés avant l'introduction de cette fonctionnalité.
  let register = await prisma.cashRegister.findFirst({
    where: { storeId: context.store.id, isActive: true },
  });
  if (!register) {
    register = await prisma.cashRegister.create({
      data: { storeId: context.store.id, name: 'Caisse principale' },
    });
  }

  const session = await prisma.cashSession.create({
    data: {
      storeId: context.store.id,
      cashRegisterId: register.id,
      userId: context.user.id,
      openingBalance: input.openingBalance,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CASH_SESSION_OPENED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'cash_session',
    targetId: session.id,
    metadata: { openingBalance: input.openingBalance },
  });

  return ok({ session }, 201);
});
