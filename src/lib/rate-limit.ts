import { prisma } from '@/lib/db';
import { RateLimitError } from '@/lib/errors';

/**
 * Limitation de débit à fenêtre glissante, persistée en base (table
 * `RateLimitHit`).
 *
 * L'application tourne en serverless (Vercel) et peut aussi tourner sur
 * Cloudflare Workers : dans les deux cas, plusieurs instances/isolats
 * traitent les requêtes en parallèle, chacun avec sa propre mémoire. Un
 * compteur en mémoire du processus ne protège donc quasiment rien contre un
 * bourrage réparti sur plusieurs requêtes concurrentes — d'où le passage à
 * un stockage partagé.
 *
 * Compromis assumé : `count()` puis `create()` ne sont pas atomiques, une
 * poignée de requêtes strictement concurrentes peut donc dépasser la limite
 * de quelques unités dans le pire cas. Acceptable pour une protection
 * anti-brute-force (l'objectif est de rendre l'attaque infaisable, pas
 * d'appliquer un quota comptable exact).
 */

export type RateLimitRule = {
  /** Nombre de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Largeur de la fenêtre, en secondes. */
  windowSeconds: number;
};

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  emailVerificationResend: { limit: 3, windowSeconds: 900 },
  checkout: { limit: 12, windowSeconds: 600 },
  upload: { limit: 40, windowSeconds: 600 },
  write: { limit: 120, windowSeconds: 60 },
  apiPublic: { limit: 120, windowSeconds: 60 },
  twoFactor: { limit: 8, windowSeconds: 300 },
  /// Confirmation de livraison : le code à six chiffres ne doit pas pouvoir
  /// être deviné par essais successifs.
  deliveryCode: { limit: 6, windowSeconds: 600 },
  /// Appel serveur / demande d'addition depuis une table donnée.
  tableCall: { limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitRule>;

/** Purge opportuniste des tentatives expirées — évite une table qui ne cesse de croître. */
async function sweep(): Promise<void> {
  await prisma.rateLimitHit
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
    .catch(() => undefined);
}

/**
 * Enregistre une tentative et lève `RateLimitError` si le quota est dépassé.
 * `key` doit isoler l'auteur : IP, et si possible identifiant de compte.
 */
export async function hit(key: string, rule: RateLimitRule): Promise<void> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Date.now() - windowMs);

  const [count] = await Promise.all([
    prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } }),
    // Purge rare (≈1 tentative sur 50) : assez fréquente pour que la table
    // ne grossisse pas sans borne, assez rare pour ne pas ajouter un
    // aller-retour supplémentaire à chaque appel.
    Math.random() < 0.02 ? sweep() : Promise.resolve(),
  ]);

  if (count >= rule.limit) {
    const oldest = await prisma.rateLimitHit.findFirst({
      where: { key, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const retryAfter = oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 1000))
      : rule.windowSeconds;
    throw new RateLimitError(
      `Trop de tentatives. Réessayez dans ${retryAfter} seconde${retryAfter > 1 ? 's' : ''}.`,
      retryAfter,
    );
  }

  await prisma.rateLimitHit.create({ data: { key } });
}

/** Efface le compteur après une opération réussie (connexion valide). */
export async function reset(key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { key } }).catch(() => undefined);
}

/** Vide l'ensemble des compteurs — réservé aux tests. */
export async function resetAll(): Promise<void> {
  await prisma.rateLimitHit.deleteMany({});
}
