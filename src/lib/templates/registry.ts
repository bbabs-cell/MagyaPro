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
      'Vitrine animée d’une seule page : votre nom qui se révèle, vos plats qui flottent, les plus commandés en carrousel et le panier toujours visible sur téléphone.',
    suggestedColors: { primary: '#e2483d', secondary: '#12151a' },
    suggestedFont: 'Inter',
    isPremium: false,
    position: 0,
  },
  {
    key: 'african-premium',
    name: 'Africain premium',
    description:
      'Page unique de nuit, or et wax : motif textile animé, plats signature en arches et carte imprimée façon grande table.',
    suggestedColors: { primary: '#c2410c', secondary: '#1c1917' },
    suggestedFont: 'Poppins',
    isPremium: false,
    position: 1,
  },
  {
    key: 'fast-food',
    name: 'Fast-food',
    description:
      'Page unique néo-brutaliste : plat vedette sur macaron tournant, autocollants qui se collent, bandeaux croisés.',
    suggestedColors: { primary: '#dc2626', secondary: '#111827' },
    suggestedFont: 'Space Grotesk',
    isPremium: false,
    position: 2,
  },
  {
    key: 'traditional',
    name: 'Traditionnel',
    description:
      'Page unique de bistrot : ardoise du jour écrite à la craie, nappe vichy, photos scotchées et livre d’or.',
    suggestedColors: { primary: '#7c2d12', secondary: '#1c1917' },
    suggestedFont: 'Playfair Display',
    isPremium: false,
    position: 3,
  },
  {
    key: 'elegant',
    name: 'Élégant',
    description:
      'Minimalisme haute couture : nom qui se révèle, sélection en portraits, carte en une colonne, d’un grand calme.',
    suggestedColors: { primary: '#0f766e', secondary: '#0c0a09' },
    suggestedFont: 'Playfair Display',
    isPremium: true,
    position: 4,
  },
  {
    key: 'street-food',
    name: 'Street Food',
    description:
      'Marché de nuit au néon : enseigne qui s’allume, tickets de commande, avis façon messagerie, carte filtrable et offre à rebours.',
    suggestedColors: { primary: '#e8281a', secondary: '#f6a623' },
    suggestedFont: 'Poppins',
    isPremium: true,
    position: 5,
  },
  {
    key: 'prestige',
    name: 'Prestige',
    description:
      'Haute gastronomie filmée comme du cinéma : bandes qui s’ouvrent sur la photo, menu dégustation en plans larges, galerie en pellicule.',
    suggestedColors: { primary: '#cda45e', secondary: '#0c0b09' },
    suggestedFont: 'Playfair Display',
    isPremium: true,
    position: 6,
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
