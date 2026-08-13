import { prisma } from '@/lib/db';
import { ConflictError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
  expiresIn,
  generateToken,
  hashToken,
} from '@/lib/auth/tokens';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mail';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { uniqueRestaurantSlug } from '@/lib/slug';

/**
 * Logique d'authentification, indépendante du transport HTTP.
 *
 * Elle est appelée par les routes d'API et directement par les tests, ce qui
 * permet de vérifier les règles de sécurité sans passer par le réseau.
 */

/** Horaires d'ouverture par défaut, appliqués à la création d'un restaurant. */
function defaultOpeningHours(restaurantId: string) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    restaurantId,
    dayOfWeek,
    // Fermé le lundi par défaut : convention courante en restauration, et le
    // restaurateur le corrige en un clic pendant l'onboarding.
    isClosed: dayOfWeek === 1,
    opensAt: '11:00',
    closesAt: '22:30',
  }));
}

/**
 * Inscription : crée l'utilisateur, son restaurant et son abonnement d'essai
 * en une transaction. Un compte sans restaurant serait un cul-de-sac.
 */
export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  restaurantName: string;
  ip?: string | null;
}) {
  const strengthError = validatePasswordStrength(input.password);
  if (strengthError) {
    throw new ValidationError(strengthError, { password: strengthError });
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('Un compte existe déjà avec cette adresse email.');
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueRestaurantSlug(input.restaurantName);

  // Le plan d'essai est choisi en base, jamais codé en dur : s'il n'existe
  // aucun plan, le restaurant est créé sans abonnement et reste utilisable en
  // lecture — l'administration pourra lui en attribuer un.
  const trialPlan = await prisma.plan.findFirst({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        platformRole: 'USER',
      },
    });

    const restaurant = await tx.restaurant.create({
      data: {
        name: input.restaurantName,
        slug,
        status: 'DRAFT',
        settings: { create: {} },
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });

    await tx.openingHour.createMany({ data: defaultOpeningHours(restaurant.id) });

    // Le sous-domaine est un domaine à part entière, vérifié d'office : il
    // nous appartient, il n'y a rien à prouver côté DNS.
    await tx.domain.create({
      data: {
        restaurantId: restaurant.id,
        hostname: slug,
        type: 'SUBDOMAIN',
        status: 'VERIFIED',
        verificationToken: generateToken(16),
        verifiedAt: new Date(),
        isPrimary: true,
      },
    });

    if (trialPlan) {
      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: trialPlan.id,
          status: 'TRIALING',
          trialEndsAt: expiresIn(trialPlan.trialDays, 'days'),
          currentPeriodEnd: expiresIn(trialPlan.trialDays, 'days'),
        },
      });
    }

    return { user, restaurant };
  });

  const verificationToken = await issueVerificationToken(
    result.user.id,
    'EMAIL_VERIFICATION',
    EMAIL_VERIFICATION_TTL_HOURS,
    'hours',
  );
  await sendVerificationEmail(result.user.email, result.user.name, verificationToken);

  await recordAudit({
    action: AUDIT_ACTIONS.USER_REGISTERED,
    actorUserId: result.user.id,
    actorEmail: result.user.email,
    restaurantId: result.restaurant.id,
    ip: input.ip,
  });
  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_CREATED,
    actorUserId: result.user.id,
    actorEmail: result.user.email,
    restaurantId: result.restaurant.id,
    targetType: 'restaurant',
    targetId: result.restaurant.id,
    ip: input.ip,
  });

  return result;
}

/**
 * Vérifie des identifiants.
 *
 * Le même message d'erreur couvre « email inconnu » et « mot de passe
 * incorrect » : les distinguer permettrait d'énumérer les comptes existants.
 */
export async function authenticate(input: {
  email: string;
  password: string;
  ip?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    // Comparaison factice pour que la réponse prenne le même temps qu'avec un
    // compte existant : sans cela, la durée de réponse révélerait les emails
    // enregistrés.
    await verifyPassword(input.password, 'scrypt$16384$8$1$AAAA$AAAA');
    await recordAudit({
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      actorEmail: input.email,
      ip: input.ip,
      metadata: { reason: 'unknown_email' },
    });
    throw new UnauthorizedError('Email ou mot de passe incorrect.');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await recordAudit({
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      actorUserId: user.id,
      actorEmail: user.email,
      ip: input.ip,
      metadata: { reason: 'bad_password' },
    });
    throw new UnauthorizedError('Email ou mot de passe incorrect.');
  }

  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError(
      'Ce compte est suspendu. Contactez le support Magya.',
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.USER_LOGIN,
    actorUserId: user.id,
    actorEmail: user.email,
    ip: input.ip,
  });

  return user;
}

/** Émet un jeton à usage unique et invalide les précédents du même type. */
async function issueVerificationToken(
  userId: string,
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  amount: number,
  unit: 'minutes' | 'hours',
): Promise<string> {
  const token = generateToken();

  await prisma.$transaction([
    // Un nouveau lien rend le précédent inopérant : deux liens de
    // réinitialisation valides en parallèle doublent la surface d'attaque.
    prisma.verificationToken.deleteMany({ where: { userId, type } }),
    prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: expiresIn(amount, unit),
      },
    }),
  ]);

  return token;
}

/**
 * Demande de réinitialisation.
 *
 * Ne signale jamais si l'adresse est connue — la route appelante répond
 * toujours la même chose, quelle que soit l'issue.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return;

  const token = await issueVerificationToken(
    user.id,
    'PASSWORD_RESET',
    PASSWORD_RESET_TTL_MINUTES,
    'minutes',
  );
  await sendPasswordResetEmail(user.email, user.name, token);
}

/**
 * Applique un nouveau mot de passe à partir d'un jeton.
 * Toutes les sessions existantes sont révoquées : si le compte était
 * compromis, l'attaquant perd son accès au moment même du changement.
 */
export async function resetPassword(input: {
  token: string;
  password: string;
  ip?: string | null;
}): Promise<void> {
  const strengthError = validatePasswordStrength(input.password);
  if (strengthError) {
    throw new ValidationError(strengthError, { password: strengthError });
  }

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true },
  });

  if (
    !record ||
    record.type !== 'PASSWORD_RESET' ||
    record.consumedAt !== null ||
    record.expiresAt < new Date()
  ) {
    throw new ValidationError(
      'Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.',
    );
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    actorUserId: record.userId,
    actorEmail: record.user.email,
    ip: input.ip,
  });
}

/** Confirme une adresse email à partir d'un jeton. */
export async function verifyEmail(token: string): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (
    !record ||
    record.type !== 'EMAIL_VERIFICATION' ||
    record.consumedAt !== null ||
    record.expiresAt < new Date()
  ) {
    throw new ValidationError(
      'Ce lien de vérification est invalide ou a expiré.',
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.USER_EMAIL_VERIFIED,
    actorUserId: record.userId,
    actorEmail: record.user.email,
  });
}
