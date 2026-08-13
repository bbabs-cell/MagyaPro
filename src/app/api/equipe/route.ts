import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { teamMemberSchema } from '@/lib/validation';
import { ConflictError, ValidationError } from '@/lib/errors';
import { FEATURES, getEntitlements, requireFeature, requireWithinLimit } from '@/lib/entitlements';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/tokens';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { sendMail } from '@/lib/mail';
import { env } from '@/lib/env';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('team:view');

  const members = await prisma.restaurantUser.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, lastLoginAt: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return ok({ members });
});

/**
 * Ajoute un membre à l'équipe.
 *
 * Si l'adresse correspond à un compte existant, celui-ci est rattaché ; sinon
 * un compte est créé avec un mot de passe aléatoire, et la personne reçoit un
 * lien de définition de mot de passe. On ne fixe jamais de mot de passe
 * « par défaut » connu.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('team:manage');

  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.MULTIPLE_USERS);
  await requireWithinLimit(context.restaurant.id, 'maxUsers', entitlements);

  const input = parseOrThrow(teamMemberSchema, await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (user) {
    const existingMembership = await prisma.restaurantUser.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: context.restaurant.id,
          userId: user.id,
        },
      },
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
          // Mot de passe inutilisable : l'accès se fait via le lien envoyé par
          // email, jamais avec une valeur devinable.
          passwordHash: await hashPassword(generateToken(24)),
        },
      }));

    return tx.restaurantUser.create({
      data: {
        restaurantId: context.restaurant.id,
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
      subject: `Vous avez été ajouté à ${context.restaurant.name} sur Magya`,
      text: [
        `Bonjour ${input.name},`,
        '',
        `${context.user.name} vous a ajouté à l'équipe de « ${context.restaurant.name} » sur Magya.`,
        '',
        'Définissez votre mot de passe pour accéder à votre espace :',
        `${env.appUrl}/mot-de-passe-oublie`,
        '',
        "L'équipe Magya",
      ].join('\n'),
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.TEAM_MEMBER_ADDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'restaurant_user',
    targetId: member.id,
    metadata: { email: input.email, role: input.role },
  });

  return ok({ member }, 201);
});
