import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import type { PlatformRole, UserStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { UnauthorizedError } from '@/lib/errors';
import {
  SESSION_TTL_DAYS,
  expiresIn,
  generateToken,
  hashToken,
} from '@/lib/auth/tokens';

export const SESSION_COOKIE = 'magyapro_session';
/** Cookie posé lorsqu'un Super Admin ouvre l'espace d'un restaurant en support. */
export const SUPPORT_COOKIE = 'magyapro_support';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true, // inaccessible à JavaScript : neutralise le vol par XSS
    secure: env.isProduction,
    sameSite: 'lax' as const, // bloque l'envoi cross-site (CSRF)
    path: '/',
    expires,
  };
}

/**
 * Ouvre une session et pose le cookie correspondant.
 * Le jeton en clair n'existe que dans le cookie ; la base n'en garde qu'un hash.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = expiresIn(SESSION_TTL_DAYS, 'days');

  const headerList = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: clientIp(headerList),
      userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return token;
}

/**
 * Ferme la session courante côté serveur *et* côté navigateur.
 * La suppression en base est ce qui compte : effacer le cookie seul laisserait
 * un jeton valide utilisable par quiconque l'aurait copié.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(SUPPORT_COOKIE);
}

/** Révoque toutes les sessions d'un utilisateur (changement de mot de passe). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Utilisateur de la requête courante, ou `null`.
 *
 * `cache()` mémorise le résultat pour la durée d'une requête : une page qui
 * appelle ce helper dans son layout, sa page et trois composants ne déclenche
 * qu'une seule lecture en base.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          status: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Un compte suspendu perd l'accès immédiatement, sans attendre l'expiration
  // de sa session.
  if (session.user.status !== 'ACTIVE') return null;

  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole !== 'SUPER_ADMIN') {
    throw new UnauthorizedError("Accès réservé à l'administration Magyapro.");
  }
  return user;
}

/** Purge les sessions expirées. Appelée opportunément à la connexion. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

/**
 * Adresse IP du client, telle que vue derrière le proxy de déploiement.
 * `x-forwarded-for` peut contenir une chaîne de relais : le premier élément
 * est l'adresse d'origine.
 */
export function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 64);
  return headerList.get('x-real-ip')?.slice(0, 64) ?? null;
}

export async function currentClientIp(): Promise<string | null> {
  return clientIp(await headers());
}
