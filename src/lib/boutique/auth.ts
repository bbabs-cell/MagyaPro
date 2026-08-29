import { prisma } from '@/lib/db';
import { ConflictError, ValidationError } from '@/lib/errors';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { issueVerificationToken } from '@/lib/auth/service';
import { EMAIL_VERIFICATION_TTL_HOURS, expiresIn } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/mail';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { uniqueStoreSlug } from '@/lib/slug';
import { scaffoldStore } from '@/lib/boutique/store-creation';

/**
 * Inscription MagyaPro Boutique — équivalent de `registerAccount` (Restaurant)
 * dans `src/lib/auth/service.ts`, jamais fusionné avec lui : les deux
 * produits créent des comptes utilisateurs dans la même table `User` (Core
 * partagé), mais chacun sa propre entité tenant (`Store` contre
 * `Restaurant`), son propre rôle par défaut, sa propre entrée d'audit.
 *
 * Un compte peut s'inscrire séparément aux deux produits avec la même
 * adresse email si l'un des deux comptes existe déjà — contrairement à
 * `registerAccount`, qui refuse toute adresse déjà utilisée, ici seule
 * l'absence d'adhésion Boutique est vérifiée : voir le contrôle plus bas.
 */
export async function registerStoreAccount(input: {
  name: string;
  email: string;
  password: string;
  storeName: string;
  planKey?: string;
  ip?: string | null;
}) {
  const strengthError = validatePasswordStrength(input.password);
  if (strengthError) {
    throw new ValidationError(strengthError, { password: strengthError });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true },
  });

  if (existingUser) {
    // Un compte Restaurant existant avec cette adresse ne peut pas être
    // réutilisé silencieusement pour Boutique sans preuve du mot de passe —
    // sans quoi n'importe qui pourrait rattacher une boutique au compte de
    // quelqu'un d'autre en connaissant seulement son email.
    throw new ConflictError(
      'Un compte existe déjà avec cette adresse email. Connectez-vous, puis ouvrez votre nouvelle boutique depuis le sélecteur en haut de la barre latérale.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueStoreSlug(input.storeName);

  const trialPlan =
    (input.planKey
      ? await prisma.plan.findFirst({
          where: { key: input.planKey, isActive: true, product: 'STORE' },
        })
      : null) ??
    (await prisma.plan.findFirst({
      where: { isActive: true, product: 'STORE' },
      orderBy: { position: 'asc' },
    }));

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        platformRole: 'USER',
      },
    });

    // Même échafaudage que l'ajout d'une boutique par un propriétaire déjà
    // connecté : point de vente, caisse et unités de départ. Une seule
    // fonction pour les deux portes, sinon elles finissent par diverger.
    const store = await scaffoldStore(tx, {
      name: input.storeName,
      slug,
      ownerAccountId: user.id,
      memberUserId: user.id,
    });

    // Seule l'inscription ouvre une période d'essai. Une boutique
    // supplémentaire se paie d'avance — voir `createAdditionalStore`.
    if (trialPlan) {
      await tx.storeSubscription.create({
        data: {
          storeId: store.id,
          planId: trialPlan.id,
          status: 'TRIALING',
          trialEndsAt: expiresIn(trialPlan.trialDays, 'days'),
          currentPeriodEnd: expiresIn(trialPlan.trialDays, 'days'),
        },
      });
    }

    return { user, store };
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
    storeId: result.store.id,
    ip: input.ip,
  });
  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CREATED,
    actorUserId: result.user.id,
    actorEmail: result.user.email,
    storeId: result.store.id,
    targetType: 'store',
    targetId: result.store.id,
    ip: input.ip,
  });

  return result;
}
