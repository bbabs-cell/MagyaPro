/**
 * Catalogue des unités proposées à la création d'une boutique, et profils par
 * secteur d'activité.
 *
 * Ce fichier ne décrit que des *valeurs par défaut* : une fois la boutique
 * créée, ses unités vivent en base (`StoreUnit`) et lui appartiennent — elle
 * peut les renommer, les désactiver ou en créer d'autres. Rien ici n'est une
 * liste fermée, contrairement à l'ancien enum `ProductUnit`.
 *
 * Sans dépendance serveur (pas d'import Prisma) : importable depuis un
 * composant client comme depuis une route API.
 */

/** Grandeur physique, pour pré-remplir un facteur de conversion vérifiable. */
export type UnitDimension = 'mass' | 'volume' | 'length' | 'area' | 'space';

export type UnitDefinition = {
  code: string;
  label: string;
  labelPlural: string;
  /** Une quantité fractionnaire a-t-elle un sens ? (1,5 kg oui, 1,5 bouteille non) */
  isDecimal: boolean;
  /**
   * Rapport à l'unité canonique de sa grandeur (gramme, millilitre,
   * millimètre, m², m³). Renseigné uniquement pour les unités dont la
   * conversion est physique et universelle : un kilo fait toujours 1 000
   * grammes, alors qu'un carton ne contient un nombre fixe de bouteilles que
   * pour un produit donné. Sert à proposer le facteur, jamais à l'imposer.
   */
  physical?: { dimension: UnitDimension; ratio: number };
};

export const UNIT_CATALOGUE: Record<string, UnitDefinition> = {
  // — Comptage —
  PIECE: { code: 'PIECE', label: 'pièce', labelPlural: 'pièces', isDecimal: false },
  PAIRE: { code: 'PAIRE', label: 'paire', labelPlural: 'paires', isDecimal: false },

  // — Masse —
  GRAMME: { code: 'GRAMME', label: 'g', labelPlural: 'g', isDecimal: true, physical: { dimension: 'mass', ratio: 1 } },
  KG: { code: 'KG', label: 'kg', labelPlural: 'kg', isDecimal: true, physical: { dimension: 'mass', ratio: 1_000 } },
  TONNE: { code: 'TONNE', label: 'tonne', labelPlural: 'tonnes', isDecimal: true, physical: { dimension: 'mass', ratio: 1_000_000 } },

  // — Volume —
  MILLILITRE: { code: 'MILLILITRE', label: 'mL', labelPlural: 'mL', isDecimal: true, physical: { dimension: 'volume', ratio: 1 } },
  LITRE: { code: 'LITRE', label: 'L', labelPlural: 'L', isDecimal: true, physical: { dimension: 'volume', ratio: 1_000 } },

  // — Longueur —
  MILLIMETRE: { code: 'MILLIMETRE', label: 'mm', labelPlural: 'mm', isDecimal: true, physical: { dimension: 'length', ratio: 1 } },
  CENTIMETRE: { code: 'CENTIMETRE', label: 'cm', labelPlural: 'cm', isDecimal: true, physical: { dimension: 'length', ratio: 10 } },
  METRE: { code: 'METRE', label: 'm', labelPlural: 'm', isDecimal: true, physical: { dimension: 'length', ratio: 1_000 } },

  // — Surface et volume de chantier —
  M2: { code: 'M2', label: 'm²', labelPlural: 'm²', isDecimal: true, physical: { dimension: 'area', ratio: 1 } },
  M3: { code: 'M3', label: 'm³', labelPlural: 'm³', isDecimal: true, physical: { dimension: 'space', ratio: 1 } },

  // — Conditionnements (facteur toujours propre au produit) —
  BOUTEILLE: { code: 'BOUTEILLE', label: 'bouteille', labelPlural: 'bouteilles', isDecimal: false },
  BIDON: { code: 'BIDON', label: 'bidon', labelPlural: 'bidons', isDecimal: false },
  BOITE: { code: 'BOITE', label: 'boîte', labelPlural: 'boîtes', isDecimal: false },
  PLAQUETTE: { code: 'PLAQUETTE', label: 'plaquette', labelPlural: 'plaquettes', isDecimal: false },
  SACHET: { code: 'SACHET', label: 'sachet', labelPlural: 'sachets', isDecimal: false },
  PAQUET: { code: 'PAQUET', label: 'paquet', labelPlural: 'paquets', isDecimal: false },
  CARTON: { code: 'CARTON', label: 'carton', labelPlural: 'cartons', isDecimal: false },
  CAISSE: { code: 'CAISSE', label: 'caisse', labelPlural: 'caisses', isDecimal: false },
  SAC: { code: 'SAC', label: 'sac', labelPlural: 'sacs', isDecimal: false },
  PLATEAU: { code: 'PLATEAU', label: 'plateau', labelPlural: 'plateaux', isDecimal: false },
  PALETTE: { code: 'PALETTE', label: 'palette', labelPlural: 'palettes', isDecimal: false },
  ROULEAU: { code: 'ROULEAU', label: 'rouleau', labelPlural: 'rouleaux', isDecimal: false },
  BOBINE: { code: 'BOBINE', label: 'bobine', labelPlural: 'bobines', isDecimal: false },
  LOT: { code: 'LOT', label: 'lot', labelPlural: 'lots', isDecimal: false },
};

/**
 * Unités semées à la création d'une boutique, selon son secteur. La première
 * de chaque liste sert d'unité de base par défaut aux nouveaux produits — le
 * commerçant peut en choisir une autre à chaque fiche.
 */
export const SECTOR_UNITS: Record<string, string[]> = {
  MERCERIE: ['METRE', 'CENTIMETRE', 'PIECE', 'ROULEAU', 'BOBINE', 'PAQUET', 'CARTON', 'LOT'],
  GROCERY: ['PIECE', 'KG', 'GRAMME', 'LITRE', 'MILLILITRE', 'BOUTEILLE', 'BIDON', 'BOITE', 'SACHET', 'PAQUET', 'CARTON', 'SAC', 'PLATEAU', 'CAISSE'],
  CLOTHING: ['PIECE', 'CARTON', 'PAQUET', 'LOT'],
  SHOES: ['PAIRE', 'PIECE', 'CARTON', 'LOT'],
  COSMETICS: ['PIECE', 'MILLILITRE', 'LITRE', 'GRAMME', 'BOITE', 'CARTON', 'LOT'],
  ELECTRONICS: ['PIECE', 'CARTON', 'LOT'],
  HARDWARE: ['PIECE', 'BOITE', 'PAQUET', 'KG', 'METRE', 'ROULEAU', 'CARTON', 'SAC'],
  CONSTRUCTION: ['SAC', 'KG', 'TONNE', 'PIECE', 'METRE', 'M2', 'M3', 'PALETTE', 'CARTON'],
  HOUSEHOLD: ['PIECE', 'LITRE', 'MILLILITRE', 'BOUTEILLE', 'BIDON', 'CARTON', 'PAQUET', 'SACHET'],
  PHARMACY: ['PIECE', 'BOITE', 'PLAQUETTE', 'MILLILITRE', 'GRAMME', 'CARTON'],
  GENERAL: ['PIECE', 'KG', 'LITRE', 'CARTON', 'PAQUET', 'BOITE', 'SAC'],
  OTHER: ['PIECE', 'KG', 'LITRE', 'METRE', 'CARTON', 'PAQUET'],
};

/**
 * Libellé français d'un secteur — source unique, importée par le tableau de
 * bord, l'espace admin et la page d'accueil Boutique. Les traductions du site
 * public vivent à part, dans `src/lib/i18n/boutique-site.ts`.
 */
export const SECTOR_LABELS: Record<string, string> = {
  MERCERIE: 'Mercerie & tissus',
  GROCERY: 'Alimentation',
  CLOTHING: 'Habillement',
  SHOES: 'Chaussures',
  COSMETICS: 'Cosmétique',
  ELECTRONICS: 'Électronique',
  HARDWARE: 'Quincaillerie',
  CONSTRUCTION: 'Matériaux de construction',
  HOUSEHOLD: 'Produits ménagers',
  PHARMACY: 'Parapharmacie',
  GENERAL: 'Commerce général',
  OTHER: 'Autre',
};

export function sectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] ?? sector;
}

/**
 * Axes de déclinaison suggérés à la création d'un produit, selon le secteur.
 * Pré-remplissage seulement : le commerçant reste libre de les renommer, d'en
 * ajouter ou de n'en garder aucun. C'est ce qui fait qu'une boutique de
 * chaussures parle de pointures là où une mercerie ne propose rien —
 * sans que le moteur, lui, connaisse la moindre différence.
 */
export const SECTOR_VARIANT_AXES: Record<string, Array<{ name: string; values: string[] }>> = {
  CLOTHING: [
    { name: 'Taille', values: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Couleur', values: [] },
  ],
  SHOES: [
    { name: 'Pointure', values: ['39', '40', '41', '42', '43'] },
    { name: 'Couleur', values: [] },
  ],
  COSMETICS: [{ name: 'Contenance', values: [] }],
  ELECTRONICS: [
    { name: 'Capacité', values: [] },
    { name: 'Couleur', values: [] },
  ],
  MERCERIE: [{ name: 'Couleur', values: [] }],
  HARDWARE: [{ name: 'Dimension', values: [] }],
  CONSTRUCTION: [{ name: 'Dimension', values: [] }],
  PHARMACY: [{ name: 'Dosage', values: [] }],
};

/**
 * Libellés d'attributs libres proposés selon le secteur — deux champs
 * génériques de la fiche produit, nommés pour le métier plutôt que
 * « Attribut 1 / Attribut 2 ».
 */
export const SECTOR_ATTRIBUTE_SUGGESTIONS: Record<string, [string, string]> = {
  CLOTHING: ['Matière', 'Coupe'],
  SHOES: ['Matière', 'Usage'],
  COSMETICS: ['Contenance', 'Teinte / Parfum'],
  ELECTRONICS: ['Numéro de série', 'Garantie'],
  GROCERY: ['Origine', 'Conservation'],
  MERCERIE: ['Couleur', 'Matière'],
  HARDWARE: ['Matière', 'Dimension'],
  CONSTRUCTION: ['Qualité', 'Provenance'],
  HOUSEHOLD: ['Contenance', 'Parfum'],
  PHARMACY: ['Dosage', 'Péremption'],
  GENERAL: ['Attribut 1', 'Attribut 2'],
  OTHER: ['Attribut 1', 'Attribut 2'],
};

export function attributeSuggestionsFor(sector: string): [string, string] {
  return SECTOR_ATTRIBUTE_SUGGESTIONS[sector] ?? SECTOR_ATTRIBUTE_SUGGESTIONS.OTHER!;
}

/** Unités d'une boutique dont le secteur n'est pas (ou plus) reconnu. */
export const FALLBACK_UNIT_CODES = SECTOR_UNITS.OTHER!;

export function unitCodesForSector(sector: string): string[] {
  return SECTOR_UNITS[sector] ?? FALLBACK_UNIT_CODES;
}

/**
 * Facteur suggéré entre deux unités quand la conversion est physique
 * (1 kg = 1 000 g, 1 m = 100 cm). `null` dès qu'au moins une des deux est un
 * conditionnement : un carton ne contient un nombre fixe d'unités que pour un
 * produit donné, c'est au commerçant de le dire.
 */
export function suggestedFactor(unitCode: string, baseUnitCode: string): number | null {
  const unit = UNIT_CATALOGUE[unitCode]?.physical;
  const base = UNIT_CATALOGUE[baseUnitCode]?.physical;
  if (!unit || !base) return null;
  if (unit.dimension !== base.dimension) return null;
  return unit.ratio / base.ratio;
}

/**
 * Correspondance entre l'ancien enum `ProductUnit` et les codes du catalogue —
 * sert à reprendre les fiches créées avant le moteur d'unités sans rien
 * demander au commerçant.
 */
export const LEGACY_UNIT_CODES: Record<string, string> = {
  UNIT: 'PIECE',
  KG: 'KG',
  GRAM: 'GRAMME',
  LITER: 'LITRE',
  MILLILITER: 'MILLILITRE',
  PACK: 'PAQUET',
};
