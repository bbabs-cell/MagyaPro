import { RateLimitError } from '@/lib/errors';

/**
 * Limitation de débit à fenêtre glissante, en mémoire.
 *
 * Portée : un processus. Cela protège efficacement contre le bourrage de
 * mot de passe et le spam de commandes sur un déploiement mono-instance, qui
 * est la cible de ce MVP. Le jour où l'application tourne sur plusieurs
 * instances, seul le corps de `hit()` change — un Redis avec la même
 * signature — sans toucher aux appelants.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Purge périodique : sans elle, la Map croîtrait avec chaque IP vue. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.timestamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else bucket.timestamps = fresh;
  }
}

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
  checkout: { limit: 12, windowSeconds: 600 },
  upload: { limit: 40, windowSeconds: 600 },
  write: { limit: 120, windowSeconds: 60 },
  /// Confirmation de livraison : le code à six chiffres ne doit pas pouvoir
  /// être deviné par essais successifs.
  deliveryCode: { limit: 6, windowSeconds: 600 },
  /// Appel serveur / demande d'addition depuis une table donnée.
  tableCall: { limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Enregistre une tentative et lève `RateLimitError` si le quota est dépassé.
 * `key` doit isoler l'auteur : IP, et si possible identifiant de compte.
 */
export function hit(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= rule.limit) {
    const oldest = bucket.timestamps[0]!;
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    throw new RateLimitError(
      `Trop de tentatives. Réessayez dans ${retryAfter} seconde${retryAfter > 1 ? 's' : ''}.`,
      retryAfter,
    );
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}

/** Efface le compteur après une opération réussie (connexion valide). */
export function reset(key: string): void {
  buckets.delete(key);
}

/** Vide l'ensemble des compteurs — réservé aux tests. */
export function resetAll(): void {
  buckets.clear();
}
