import { prisma } from '@/lib/db';

/**
 * Constantes du système de templates Boutique, séparées des composants React
 * (`src/components/site-store/templates/index.tsx`) pour rester importables
 * depuis du code serveur pur (routes API, onboarding) sans tirer l'arbre de
 * composants du site public.
 */
export const DEFAULT_TEMPLATE_KEY = 'classic';

/** Suggestion de template par défaut selon le secteur — modifiable librement ensuite. */
export const SUGGESTED_TEMPLATE_BY_SECTOR: Record<string, string> = {
  CLOTHING: 'mode',
  ELECTRONICS: 'vitrine',
  COSMETICS: 'mode',
  GROCERY: 'marche',
  MERCERIE: 'vitrine',
  OTHER: 'classic',
};

export const STORE_TEMPLATE_KEYS = ['classic', 'mode', 'vitrine', 'marche'] as const;

const DEFAULT_STORE_TEMPLATES = [
  {
    key: 'classic',
    name: 'Classique',
    description: 'Épuré et polyvalent, catalogue en grille — convient à tout type de commerce.',
    position: 0,
  },
  {
    key: 'mode',
    name: 'Mode',
    description: "Grandes photos, mise en avant du visuel — pensé pour l'habillement et les accessoires.",
    position: 1,
  },
  {
    key: 'vitrine',
    name: 'Vitrine',
    description: "Grille dense, prix visibles — pensé pour l'électronique et les commerces à large catalogue.",
    position: 2,
  },
  {
    key: 'marche',
    name: 'Marché',
    description: "Liste compacte façon étal, prix en avant — pensé pour l'alimentation et l'épicerie.",
    position: 3,
  },
];

export type StoreTemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
};

/**
 * Registre des templates Boutique, prêt pour la galerie de sélection —
 * sème les 4 templates par défaut au premier appel si la table est encore
 * vide (déploiement qui n'a pas encore exécuté `seed_store_templates.sql`),
 * jamais une galerie vide qui empêcherait de choisir un template.
 */
export async function getStoreTemplates(): Promise<StoreTemplateRow[]> {
  const existing = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });

  if (existing.length === 0) {
    const seeded = await prisma.$transaction(
      DEFAULT_STORE_TEMPLATES.map((entry) => prisma.storeTemplate.create({ data: entry })),
    );
    return seeded;
  }

  return existing;
}
