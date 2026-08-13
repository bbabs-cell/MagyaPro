import { prisma } from '@/lib/db';

/** Mots réservés : ils entreraient en collision avec les sous-domaines système. */
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'auth', 'login', 'register',
  'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'blog', 'docs', 'help',
  'support', 'status', 'magya', 'demo', 'test', 'staging', 'preview',
]);

/**
 * Normalise une chaîne en identifiant d'URL : minuscules, accents retirés,
 * séparateurs uniformisés. « Chez Fatou — Grillades » → « chez-fatou-grillades ».
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Produit un slug de restaurant libre au niveau de la plateforme.
 * Le slug sert de sous-domaine, il doit donc être globalement unique.
 */
export async function uniqueRestaurantSlug(name: string): Promise<string> {
  const base = slugify(name) || 'restaurant';
  let candidate = isReservedSlug(base) ? `${base}-resto` : base;

  for (let suffix = 2; suffix < 200; suffix++) {
    const taken = await prisma.restaurant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
  }
  // Improbable : on bascule sur un suffixe aléatoire plutôt que d'échouer.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Produit un slug unique **à l'intérieur d'un restaurant** (catégorie, produit).
 * `excludeId` permet de renommer une entité sans entrer en conflit avec
 * elle-même.
 */
export async function uniqueChildSlug(
  model: 'category' | 'product',
  restaurantId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || model;
  let candidate = base;

  for (let suffix = 2; suffix < 200; suffix++) {
    const existing =
      model === 'category'
        ? await prisma.category.findUnique({
            where: { restaurantId_slug: { restaurantId, slug: candidate } },
            select: { id: true },
          })
        : await prisma.product.findUnique({
            where: { restaurantId_slug: { restaurantId, slug: candidate } },
            select: { id: true },
          });

    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
