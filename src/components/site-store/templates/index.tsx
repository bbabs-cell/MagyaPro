import { ClassicHero, ClassicProductGrid } from './classic';
import { ModeHero, ModeProductGrid } from './mode';
import { VitrineHero, VitrineProductGrid } from './vitrine';
import { MarcheHero, MarcheProductGrid } from './marche';
import { DEFAULT_TEMPLATE_KEY } from '@/lib/boutique/store-templates';
import type { StoreHeroProps, StoreProductGridProps } from './types';

export type { StoreHeroProps, StoreProductGridProps, StoreCategoryOption } from './types';
export { DEFAULT_TEMPLATE_KEY, SUGGESTED_TEMPLATE_BY_SECTOR, STORE_TEMPLATE_KEYS } from '@/lib/boutique/store-templates';

type TemplateRenderer = {
  Hero: (props: StoreHeroProps) => React.ReactElement;
  ProductGrid: (props: StoreProductGridProps) => React.ReactElement;
};

/**
 * Registre des mises en page du site public MagyaPro Boutique — même
 * principe que `src/components/site/templates/index.tsx` (Restaurant) :
 * `Store.templateKey` sélectionne une paire de composants React, pas
 * seulement des couleurs. Voir `StoreTemplate` pour le registre
 * d'affichage/activation en base.
 */
const TEMPLATE_RENDERERS: Record<string, TemplateRenderer> = {
  classic: { Hero: ClassicHero, ProductGrid: ClassicProductGrid },
  mode: { Hero: ModeHero, ProductGrid: ModeProductGrid },
  vitrine: { Hero: VitrineHero, ProductGrid: VitrineProductGrid },
  marche: { Hero: MarcheHero, ProductGrid: MarcheProductGrid },
};

export function storeTemplateRenderer(key: string): TemplateRenderer {
  return TEMPLATE_RENDERERS[key] ?? TEMPLATE_RENDERERS[DEFAULT_TEMPLATE_KEY]!;
}
