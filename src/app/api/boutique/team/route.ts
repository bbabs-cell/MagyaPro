import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeTeamMemberSchema } from '@/lib/validation';
import { ConflictError } from '@/lib/errors';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/tokens';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { sendMail } from '@/lib/mail';
import { env } from '@/lib/env';

export const GET = route(async () => {
  const { store } = await requireStore('employees:view');

  const members = await prisma.storeUser.findMany({
    where: { storeId: store.id },
    include: {
      user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return ok({ members });
});

/**
 * Ajoute un membre à l'équipe de la boutique — même principe que
 * `/api/equipe` côté Restaurant : rattache un compte existant, ou en crée un
 * avec un mot de passe inutilisable et invite par email à en définir un.
 */
export const POST = route(async (request) => {
  const context = await requireStore('employees:manage');

  const input = parseOrThrow(storeTeamMemberSchema, await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (user) {
    const existingMembership = await prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId: context.store.id, userId: user.id } },
      select: { id: true },
    });
    if (existingMembership) {
      throw new ConflictError('Cette personne fait déjà partie de votre équipe.');
    }
  }

  const member = await prisma.$transaction(async (tx) => {
    const account =
      user ??
      (await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(generateToken(24)),
        },
      }));

    return tx.storeUser.create({
      data: {
        storeId: context.store.id,
        userId: account.id,
        role: input.role,
        extraPermissions: input.extraPermissions,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  });

  if (!user) {
    await sendMail({
      to: input.email,
      subject: `Vous avez été ajouté à ${context.store.name} sur Magyapro Boutique`,
      text: [
        `Bonjour ${input.name},`,
        '',
        `${context.user.name} vous a ajouté à l'équipe de « ${context.store.name} » sur Magyapro Boutique.`,
        '',
        'Définissez votre mot de passe pour accéder à votre espace :',
        `${env.appUrl}/mot-de-passe-oublie`,
        '',
        "L'équipe Magyapro",
      ].join('\n'),
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_TEAM_MEMBER_ADDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_user',
    targetId: member.id,
    metadata: { email: input.email, role: input.role },
  });

  return ok({ member }, 201);
});
