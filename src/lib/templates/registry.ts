/**
 * Registre des templates de site public.
 *
 * Un template décrit uniquement une *présentation*. Tous consomment les mêmes
 * données du restaurant, si bien qu'en changer n'altère jamais le menu, les
 * photos, les commandes ni les clients.
 *
 * Ajouter un template : créer son composant dans `src/components/site/templates`,
 * l'enregistrer ici, puis insérer sa ligne dans la table `templates` (le seed
 * s'en charge pour les templates fournis).
 */

export type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  /** Palette suggérée à la sélection ; le restaurateur reste libre de la changer. */
  suggestedColors: { primary: string; secondary: string };
  suggestedFont: string;
  isPremium: boolean;
  position: number;
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    key: 'modern',
    name: 'Moderne',
    description:
      'Bento éditorial : volets asymétriques, halo de couleur en fond et menu en tuiles avec le produit vedette en grand.',
    suggestedColors: { primary: '#e2483d', secondary: '#12151a' },
    suggestedFont: 'Inter',
    isPremium: false,
    position: 0,
  },
  {
    key: 'african-premium',
    name: 'Africain premium',
    description:
      'Éditorial doré : fond sombre texturé, cadre photo décalé et carte numérotée façon restaurant gastronomique.',
    suggestedColors: { primary: '#c2410c', secondary: '#1c1917' },
    suggestedFont: 'Poppins',
    isPremium: false,
    position: 1,
  },
  {
    key: 'fast-food',
    name: 'Fast-food',
    description:
      'Néo-brutaliste et énergique : blocs de couleur pleine teinte, ombres décalées façon autocollant, prix en pastille.',
    suggestedColors: { primary: '#dc2626', secondary: '#111827' },
    suggestedFont: 'Space Grotesk',
    isPremium: false,
    position: 2,
  },
  {
    key: 'traditional',
    name: 'Traditionnel',
    description:
      'Héros plein cadre avec bandeau d\'infos pratiques, et carte organisée par pastilles de catégories.',
    suggestedColors: { primary: '#7c2d12', secondary: '#1c1917' },
    suggestedFont: 'Playfair Display',
    isPremium: false,
    position: 3,
  },
  {
    key: 'elegant',
    name: 'Élégant',
    description:
      'Minimalisme haute couture : initiale en filigrane géant, carte en une colonne, sans image, d\'un grand calme.',
    suggestedColors: { primary: '#0f766e', secondary: '#0c0a09' },
    suggestedFont: 'Playfair Display',
    isPremium: true,
    position: 4,
  },
];

export const PREMIUM_TEMPLATE_KEYS = new Set(
  TEMPLATES.filter((template) => template.isPremium).map((template) => template.key),
);

export const DEFAULT_TEMPLATE_KEY = 'modern';

export function getTemplate(key: string): TemplateDefinition {
  return (
    TEMPLATES.find((template) => template.key === key) ??
    TEMPLATES.find((template) => template.key === DEFAULT_TEMPLATE_KEY)!
  );
}
