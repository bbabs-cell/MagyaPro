import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { seedStoreUnits } from '@/lib/boutique/units-engine';
import type { Prisma, StoreBusinessType } from '@prisma/client';

/**
 * Données de démonstration MagyaPro Boutique — une boutique fictive par
 * secteur (`StoreBusinessType`), pour qu'un prospect ou un nouveau
 * propriétaire puisse explorer caisse, stock, ventes, prévisions et analyses
 * avec un jeu de données réaliste avant d'entrer les siennes.
 *
 * Toutes portent `isDemo: true` (site public non indexable, bandeau
 * explicite côté vitrine) et sont créées/retirées depuis l'administration
 * (`/admin/boutiques`, `src/app/api/admin/boutique-demo/route.ts`) —
 * jamais automatiquement, et jamais présentées comme de vraies boutiques.
 *
 * Trois exigences ont guidé la réécriture de ce fichier :
 *
 * 1. **Cohérence.** Le stock affiché est la conséquence des ventes écrites.
 *    Chaque variante part d'un stock initial, chaque vente laisse un
 *    mouvement daté avec sa quantité avant et après, et l'inventaire final
 *    est exactement ce que cette suite produit. Une démo dont le stock ne
 *    correspond pas à son historique se remarque en trente secondes et ruine
 *    la confiance dans le reste.
 * 2. **Représentativité.** Les unités, conditionnements et déclinaisons du
 *    moteur d'unités sont réellement utilisés : cartons, mètres, paires,
 *    pointures. Une démo sans carton ne montre pas ce que le logiciel sait
 *    faire.
 * 3. **Lisibilité des états.** Chaque boutique contient volontairement des
 *    produits en stock normal, en stock faible, en rupture imminente, en
 *    rupture et dormants — les quatre niveaux de l'écran Prévisions et la
 *    liste de l'écran Analyses ne sont jamais vides.
 */

/** Conditionnement d'un produit : un carton, un paquet, un rouleau… */
type DemoPack = {
  /** Code d'unité du catalogue (`UNIT_CATALOGUE`), déjà semé pour le secteur. */
  code: string;
  /** Unités de base contenues dans un conditionnement. */
  factor: number;
  /** Prix du conditionnement complet — jamais déduit du facteur. */
  price: number;
  cost: number;
};

/**
 * État de stock voulu à l'écran. Sert uniquement à choisir le stock final :
 * les chiffres restent cohérents avec l'historique de ventes généré.
 */
type DemoState = 'ok' | 'low' | 'imminent' | 'out' | 'dormant';

type DemoProduct = {
  name: string;
  /** Code de l'unité de base — celle dans laquelle le stock est compté. */
  baseUnit: string;
  price: number;
  cost: number;
  packs?: DemoPack[];
  axes?: Array<{ name: string; values: string[] }>;
  /** Une entrée par déclinaison. Absent = produit sans déclinaison. */
  variants?: Array<{ attributes: Record<string, string>; price?: number; cost?: number }>;
  state?: DemoState;
  /** Délai de réapprovisionnement, en jours. */
  leadDays?: number;
};

type DemoCategory = { name: string; products: DemoProduct[] };

type DemoStoreDefinition = {
  slug: string;
  name: string;
  description: string;
  businessType: StoreBusinessType;
  city: string;
  country: string;
  phone: string;
  categories: DemoCategory[];
};

const DEMO_STORES: DemoStoreDefinition[] = [
  // ---------------------------------------------------------------- Mercerie
  {
    slug: 'demo-fil-et-aiguille',
    name: 'Fil & Aiguille',
    description:
      'Tissus au mètre, mercerie et fournitures de couture. Boutique de démonstration Magyapro.',
    businessType: 'MERCERIE',
    city: 'Bamako',
    country: 'Mali',
    phone: '+223 76 00 10 01',
    categories: [
      {
        name: 'Tissus au mètre',
        products: [
          {
            name: 'Wax hollandais',
            baseUnit: 'METRE',
            price: 4500,
            cost: 3000,
            // Un pagne se vend au mètre, s'achète au rouleau de 6 yards.
            packs: [{ code: 'ROULEAU', factor: 5.5, price: 23000, cost: 16000 }],
            axes: [{ name: 'Couleur', values: ['Indigo', 'Ocre', 'Vert'] }],
            variants: [
              { attributes: { Couleur: 'Indigo' } },
              { attributes: { Couleur: 'Ocre' } },
              { attributes: { Couleur: 'Vert' }, price: 4800, cost: 3200 },
            ],
            state: 'ok',
            leadDays: 10,
          },
          {
            name: 'Bazin riche',
            baseUnit: 'METRE',
            price: 7000,
            cost: 5000,
            packs: [{ code: 'ROULEAU', factor: 5, price: 32000, cost: 24000 }],
            state: 'low',
            leadDays: 12,
          },
          {
            name: 'Voile brodé',
            baseUnit: 'METRE',
            price: 5500,
            cost: 3800,
            state: 'imminent',
            leadDays: 14,
          },
        ],
      },
      {
        name: 'Mercerie',
        products: [
          {
            name: 'Bobine de fil polyester',
            baseUnit: 'BOBINE',
            price: 500,
            cost: 280,
            packs: [{ code: 'PAQUET', factor: 12, price: 5200, cost: 3000 }],
            state: 'ok',
            leadDays: 7,
          },
          {
            name: 'Fermeture éclair 40 cm',
            baseUnit: 'PIECE',
            price: 350,
            cost: 180,
            packs: [{ code: 'PAQUET', factor: 25, price: 7500, cost: 4200 }],
            state: 'out',
            leadDays: 7,
          },
          {
            name: 'Boutons nacrés',
            baseUnit: 'PIECE',
            price: 100,
            cost: 40,
            packs: [{ code: 'PAQUET', factor: 50, price: 4000, cost: 1800 }],
            state: 'ok',
            leadDays: 7,
          },
          {
            name: 'Ruban satin 2 cm',
            baseUnit: 'METRE',
            price: 300,
            cost: 150,
            packs: [{ code: 'ROULEAU', factor: 25, price: 6500, cost: 3500 }],
            state: 'dormant',
            leadDays: 10,
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------ Alimentation
  {
    slug: 'demo-marche-du-coin',
    name: 'Marché du Coin',
    description:
      'Épicerie de quartier : riz, huile, boissons et produits frais. Boutique de démonstration Magyapro.',
    businessType: 'GROCERY',
    city: 'Cotonou',
    country: 'Bénin',
    phone: '+229 97 00 10 04',
    categories: [
      {
        name: 'Épicerie sèche',
        products: [
          {
            name: 'Riz parfumé',
            baseUnit: 'KG',
            price: 900,
            cost: 650,
            // Le sac de 25 kg n'est pas 25 fois le prix du kilo : le prix du
            // conditionnement est saisi tel quel, jamais déduit du facteur.
            packs: [{ code: 'SAC', factor: 25, price: 20000, cost: 15500 }],
            state: 'ok',
            leadDays: 5,
          },
          {
            name: 'Huile végétale 1 L',
            baseUnit: 'BOUTEILLE',
            price: 1800,
            cost: 1300,
            packs: [{ code: 'CARTON', factor: 12, price: 20400, cost: 15000 }],
            state: 'low',
            leadDays: 6,
          },
          {
            name: 'Sucre en poudre',
            baseUnit: 'KG',
            price: 1000,
            cost: 720,
            packs: [{ code: 'SAC', factor: 50, price: 46000, cost: 34000 }],
            state: 'ok',
            leadDays: 5,
          },
          {
            name: 'Tomate concentrée 70 g',
            baseUnit: 'BOITE',
            price: 500,
            cost: 300,
            packs: [{ code: 'CARTON', factor: 50, price: 22000, cost: 14000 }],
            state: 'imminent',
            leadDays: 8,
          },
        ],
      },
      {
        name: 'Boissons',
        products: [
          {
            name: 'Eau minérale 1,5 L',
            baseUnit: 'BOUTEILLE',
            price: 500,
            cost: 300,
            packs: [{ code: 'CARTON', factor: 12, price: 5400, cost: 3400 }],
            state: 'ok',
            leadDays: 3,
          },
          {
            name: 'Jus de fruits 1 L',
            baseUnit: 'BOUTEILLE',
            price: 1500,
            cost: 950,
            packs: [{ code: 'CARTON', factor: 6, price: 8400, cost: 5500 }],
            state: 'out',
            leadDays: 7,
          },
          {
            name: 'Soda 33 cl',
            baseUnit: 'BOUTEILLE',
            price: 600,
            cost: 350,
            packs: [{ code: 'CAISSE', factor: 24, price: 13200, cost: 8200 }],
            state: 'ok',
            leadDays: 4,
          },
        ],
      },
      {
        name: 'Frais',
        products: [
          {
            name: 'Œufs',
            baseUnit: 'PIECE',
            price: 125,
            cost: 95,
            packs: [{ code: 'PLATEAU', factor: 30, price: 3400, cost: 2700 }],
            state: 'low',
            leadDays: 2,
          },
          {
            name: 'Lait en poudre 400 g',
            baseUnit: 'BOITE',
            price: 2200,
            cost: 1600,
            packs: [{ code: 'CARTON', factor: 24, price: 50000, cost: 37000 }],
            state: 'dormant',
            leadDays: 10,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- Habillement
  {
    slug: 'demo-wax-style',
    name: 'Wax & Style',
    description:
      'Prêt-à-porter et pagnes wax, coupes pour toute la famille. Boutique de démonstration Magyapro.',
    businessType: 'CLOTHING',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    phone: '+225 07 00 10 01',
    categories: [
      {
        name: 'Robes',
        products: [
          {
            name: 'Robe wax imprimée',
            baseUnit: 'PIECE',
            price: 15000,
            cost: 8000,
            axes: [{ name: 'Taille', values: ['S', 'M', 'L'] }],
            variants: [
              { attributes: { Taille: 'S' } },
              { attributes: { Taille: 'M' } },
              { attributes: { Taille: 'L' }, price: 16000, cost: 8500 },
            ],
            state: 'ok',
            leadDays: 14,
          },
          {
            name: 'Robe de soirée unie',
            baseUnit: 'PIECE',
            price: 22000,
            cost: 12000,
            state: 'low',
            leadDays: 21,
          },
        ],
      },
      {
        name: 'Chemises',
        products: [
          {
            name: 'Chemise homme col mao',
            baseUnit: 'PIECE',
            price: 12000,
            cost: 6500,
            axes: [{ name: 'Taille', values: ['M', 'L', 'XL'] }],
            variants: [
              { attributes: { Taille: 'M' } },
              { attributes: { Taille: 'L' } },
              { attributes: { Taille: 'XL' }, price: 13000, cost: 7000 },
            ],
            state: 'imminent',
            leadDays: 14,
          },
          {
            name: 'Chemise femme légère',
            baseUnit: 'PIECE',
            price: 9500,
            cost: 5000,
            state: 'ok',
            leadDays: 14,
          },
        ],
      },
      {
        name: 'Accessoires',
        products: [
          {
            name: 'Foulard wax',
            baseUnit: 'PIECE',
            price: 3500,
            cost: 1800,
            packs: [{ code: 'LOT', factor: 10, price: 30000, cost: 16000 }],
            state: 'out',
            leadDays: 10,
          },
          {
            name: 'Ceinture cuir tressé',
            baseUnit: 'PIECE',
            price: 6000,
            cost: 3200,
            state: 'dormant',
            leadDays: 20,
          },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- Chaussures
  {
    slug: 'demo-pas-a-pas',
    name: 'Pas à Pas',
    description:
      'Chaussures ville, sport et enfants, toutes pointures. Boutique de démonstration Magyapro.',
    businessType: 'SHOES',
    city: 'Lomé',
    country: 'Togo',
    phone: '+228 90 00 10 05',
    categories: [
      {
        name: 'Ville',
        products: [
          {
            name: 'Mocassin cuir homme',
            baseUnit: 'PAIRE',
            price: 28000,
            cost: 17000,
            packs: [{ code: 'CARTON', factor: 6, price: 156000, cost: 99000 }],
            axes: [{ name: 'Pointure', values: ['40', '41', '42', '43'] }],
            variants: [
              { attributes: { Pointure: '40' } },
              { attributes: { Pointure: '41' } },
              { attributes: { Pointure: '42' } },
              { attributes: { Pointure: '43' }, price: 29000, cost: 17500 },
            ],
            state: 'ok',
            leadDays: 21,
          },
          {
            name: 'Escarpin femme',
            baseUnit: 'PAIRE',
            price: 24000,
            cost: 14000,
            axes: [{ name: 'Pointure', values: ['37', '38', '39'] }],
            variants: [
              { attributes: { Pointure: '37' } },
              { attributes: { Pointure: '38' } },
              { attributes: { Pointure: '39' } },
            ],
            state: 'low',
            leadDays: 21,
          },
        ],
      },
      {
        name: 'Sport',
        products: [
          {
            name: 'Basket running',
            baseUnit: 'PAIRE',
            price: 32000,
            cost: 21000,
            packs: [{ code: 'CARTON', factor: 8, price: 240000, cost: 160000 }],
            axes: [{ name: 'Pointure', values: ['41', '42', '43'] }],
            variants: [
              { attributes: { Pointure: '41' } },
              { attributes: { Pointure: '42' } },
              { attributes: { Pointure: '43' } },
            ],
            state: 'imminent',
            leadDays: 25,
          },
          {
            name: 'Sandale plastique',
            baseUnit: 'PAIRE',
            price: 3500,
            cost: 1900,
            packs: [{ code: 'CARTON', factor: 24, price: 78000, cost: 43000 }],
            state: 'out',
            leadDays: 12,
          },
        ],
      },
      {
        name: 'Enfants',
        products: [
          {
            name: 'Chaussure scolaire enfant',
            baseUnit: 'PAIRE',
            price: 12000,
            cost: 7000,
            axes: [{ name: 'Pointure', values: ['30', '32', '34'] }],
            variants: [
              { attributes: { Pointure: '30' } },
              { attributes: { Pointure: '32' } },
              { attributes: { Pointure: '34' } },
            ],
            state: 'ok',
            leadDays: 18,
          },
          {
            name: 'Botte pluie enfant',
            baseUnit: 'PAIRE',
            price: 9000,
            cost: 5200,
            state: 'dormant',
            leadDays: 25,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- Électronique
  {
    slug: 'demo-teranga-tech',
    name: 'Teranga Tech',
    description:
      'Téléphones, accessoires et petit électroménager. Boutique de démonstration Magyapro.',
    businessType: 'ELECTRONICS',
    city: 'Dakar',
    country: 'Sénégal',
    phone: '+221 77 00 10 02',
    categories: [
      {
        name: 'Téléphonie',
        products: [
          {
            name: 'Smartphone 128 Go',
            baseUnit: 'PIECE',
            price: 135000,
            cost: 105000,
            axes: [{ name: 'Couleur', values: ['Noir', 'Bleu'] }],
            variants: [{ attributes: { Couleur: 'Noir' } }, { attributes: { Couleur: 'Bleu' } }],
            state: 'low',
            leadDays: 20,
          },
          {
            name: 'Téléphone à touches',
            baseUnit: 'PIECE',
            price: 12000,
            cost: 8000,
            packs: [{ code: 'CARTON', factor: 20, price: 220000, cost: 155000 }],
            state: 'ok',
            leadDays: 15,
          },
        ],
      },
      {
        name: 'Accessoires',
        products: [
          {
            name: 'Chargeur rapide USB-C',
            baseUnit: 'PIECE',
            price: 6000,
            cost: 3200,
            packs: [{ code: 'CARTON', factor: 24, price: 132000, cost: 74000 }],
            state: 'ok',
            leadDays: 12,
          },
          {
            name: 'Écouteurs sans fil',
            baseUnit: 'PIECE',
            price: 18000,
            cost: 11000,
            packs: [{ code: 'CARTON', factor: 10, price: 168000, cost: 105000 }],
            state: 'imminent',
            leadDays: 18,
          },
          {
            name: 'Coque silicone',
            baseUnit: 'PIECE',
            price: 2500,
            cost: 900,
            packs: [{ code: 'LOT', factor: 50, price: 110000, cost: 42000 }],
            state: 'out',
            leadDays: 12,
          },
        ],
      },
      {
        name: 'Maison',
        products: [
          {
            name: 'Ventilateur sur pied',
            baseUnit: 'PIECE',
            price: 32000,
            cost: 22000,
            state: 'ok',
            leadDays: 20,
          },
          {
            name: 'Fer à repasser vapeur',
            baseUnit: 'PIECE',
            price: 19000,
            cost: 13500,
            state: 'dormant',
            leadDays: 25,
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------- Quincaillerie
  {
    slug: 'demo-le-bon-outil',
    name: 'Le Bon Outil',
    description:
      'Quincaillerie générale : visserie, plomberie, électricité, outillage. Boutique de démonstration Magyapro.',
    businessType: 'HARDWARE',
    city: 'Ouagadougou',
    country: 'Burkina Faso',
    phone: '+226 70 00 10 06',
    categories: [
      {
        name: 'Visserie',
        products: [
          {
            name: 'Vis à bois 4×40',
            baseUnit: 'PIECE',
            price: 50,
            cost: 22,
            // Vendue à l'unité, à la boîte de 100 ou au carton de 10 boîtes.
            packs: [
              { code: 'BOITE', factor: 100, price: 4200, cost: 2000 },
              { code: 'CARTON', factor: 1000, price: 38000, cost: 18500 },
            ],
            state: 'ok',
            leadDays: 10,
          },
          {
            name: 'Cheville nylon 8 mm',
            baseUnit: 'PIECE',
            price: 40,
            cost: 15,
            packs: [{ code: 'BOITE', factor: 100, price: 3400, cost: 1400 }],
            state: 'low',
            leadDays: 10,
          },
        ],
      },
      {
        name: 'Électricité',
        products: [
          {
            name: 'Câble électrique 2,5 mm²',
            baseUnit: 'METRE',
            price: 600,
            cost: 380,
            packs: [{ code: 'ROULEAU', factor: 100, price: 54000, cost: 35000 }],
            state: 'ok',
            leadDays: 14,
          },
          {
            name: 'Interrupteur simple',
            baseUnit: 'PIECE',
            price: 1500,
            cost: 800,
            packs: [{ code: 'BOITE', factor: 20, price: 27000, cost: 15000 }],
            state: 'imminent',
            leadDays: 12,
          },
        ],
      },
      {
        name: 'Outillage et bâtiment',
        products: [
          {
            name: 'Marteau charpentier',
            baseUnit: 'PIECE',
            price: 4500,
            cost: 2600,
            state: 'ok',
            leadDays: 20,
          },
          {
            name: 'Ciment 50 kg',
            baseUnit: 'SAC',
            price: 5200,
            cost: 4300,
            state: 'out',
            leadDays: 4,
          },
          {
            name: 'Peinture acrylique',
            baseUnit: 'KG',
            price: 2800,
            cost: 1900,
            packs: [{ code: 'BOITE', factor: 20, price: 52000, cost: 36000 }],
            state: 'dormant',
            leadDays: 15,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Cosmétique
  {
    slug: 'demo-eclat-naturel',
    name: 'Éclat Naturel',
    description:
      'Cosmétiques, soins capillaires et parfums. Boutique de démonstration Magyapro.',
    businessType: 'COSMETICS',
    city: 'Douala',
    country: 'Cameroun',
    phone: '+237 6 90 00 10 03',
    categories: [
      {
        name: 'Soins du corps',
        products: [
          {
            name: 'Beurre de karité pur',
            baseUnit: 'PIECE',
            price: 3500,
            cost: 1800,
            packs: [{ code: 'CARTON', factor: 24, price: 76000, cost: 40000 }],
            axes: [{ name: 'Contenance', values: ['250 g', '500 g'] }],
            variants: [
              { attributes: { Contenance: '250 g' } },
              { attributes: { Contenance: '500 g' }, price: 6000, cost: 3200 },
            ],
            state: 'ok',
            leadDays: 12,
          },
          {
            name: 'Savon noir africain',
            baseUnit: 'PIECE',
            price: 1200,
            cost: 600,
            packs: [{ code: 'CARTON', factor: 40, price: 42000, cost: 22000 }],
            state: 'low',
            leadDays: 10,
          },
        ],
      },
      {
        name: 'Cheveux',
        products: [
          {
            name: 'Huile de ricin 100 mL',
            baseUnit: 'PIECE',
            price: 2500,
            cost: 1200,
            packs: [{ code: 'BOITE', factor: 12, price: 27000, cost: 13500 }],
            state: 'imminent',
            leadDays: 14,
          },
          {
            name: 'Shampoing hydratant',
            baseUnit: 'PIECE',
            price: 4000,
            cost: 2300,
            state: 'out',
            leadDays: 14,
          },
        ],
      },
      {
        name: 'Parfums',
        products: [
          {
            name: 'Eau de parfum florale',
            baseUnit: 'PIECE',
            price: 18000,
            cost: 11000,
            state: 'ok',
            leadDays: 25,
          },
          {
            name: 'Brume corporelle',
            baseUnit: 'PIECE',
            price: 7500,
            cost: 4200,
            state: 'dormant',
            leadDays: 20,
          },
        ],
      },
    ],
  },
];

const DEMO_CUSTOMERS = [
  { name: 'Aïcha Diallo', phone: '+225 07 20 20 20' },
  { name: 'Moussa Sow', phone: '+221 77 30 30 30' },
  { name: 'Grace Adjovi', phone: '+229 97 40 40 40' },
  { name: 'Yao Kouadio', phone: '+225 07 50 50 50' },
];

/** Fenêtre d'historique générée. Couvre les 30 jours lus par les prévisions. */
const HISTORY_DAYS = 45;

/** Générateur pseudo-aléatoire à graine : le seed produit toujours la même démo. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Unité vendable d'une variante de démonstration, telle qu'écrite en base. */
type PoolUnit = { id: string; label: string; factor: number; price: number };

type PoolEntry = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  units: PoolUnit[];
  state: DemoState;
  leadDays: number;
  /** Ventes cumulées, en unité de base — rempli pendant la génération. */
  sold: number;
};

/** Une ligne de vente planifiée, avant écriture. */
type PlannedLine = {
  entry: PoolEntry;
  unit: PoolUnit;
  /** Quantité exprimée dans `unit`. */
  packs: number;
  /** Quantité en unité de base : `packs × unit.factor`. */
  quantity: number;
};

/**
 * Crée les boutiques de démonstration (une par secteur), avec unités,
 * conditionnements, déclinaisons, stock, clients, promotion, historique de
 * ventes et mouvements de stock cohérents.
 *
 * Idempotent : une boutique dont le slug existe déjà est ignorée. Pour la
 * régénérer, passer par `resetStoreDemos`.
 */
export async function seedStoreDemos(): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const passwordHash = await hashPassword('Demo!2345');

  for (const [storeIndex, definition] of DEMO_STORES.entries()) {
    const existing = await prisma.store.findUnique({
      where: { slug: definition.slug },
      select: { id: true },
    });
    if (existing) {
      skipped.push(definition.name);
      continue;
    }

    await seedOneStore(definition, storeIndex, passwordHash);
    created.push(definition.name);
  }

  return { created, skipped };
}

async function seedOneStore(
  definition: DemoStoreDefinition,
  storeIndex: number,
  passwordHash: string,
): Promise<void> {
  const random = seededRandom(20260828 + storeIndex * 7919);

  const owner = await prisma.user.create({
    data: {
      email: `${definition.slug}@demo.magyapro.app`,
      name: `Propriétaire ${definition.name}`,
      passwordHash,
      emailVerifiedAt: new Date(),
      isDemo: true,
    },
  });

  const store = await prisma.store.create({
    data: {
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      businessType: definition.businessType,
      status: 'ACTIVE',
      isDemo: true,
      city: definition.city,
      country: definition.country,
      phone: definition.phone,
      email: `contact@${definition.slug}.demo`,
      currency: 'XOF',
      onboardingStep: 5,
      onboardingCompletedAt: new Date(),
      publishedAt: new Date(),
      members: { create: { userId: owner.id, role: 'OWNER' } },
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: { storeId: store.id, name: 'Boutique principale', isDefault: true },
  });

  // Les unités du secteur, exactement comme pour une vraie boutique : la démo
  // ne doit rien connaître que le moteur d'unités ne sache faire.
  await seedStoreUnits(store.id, definition.businessType);
  const storeUnits = await prisma.storeUnit.findMany({
    where: { storeId: store.id },
    select: { id: true, code: true, label: true, labelPlural: true },
  });
  const unitByCode = new Map(storeUnits.map((unit) => [unit.code, unit]));

  const pool: PoolEntry[] = [];

  for (const [categoryIndex, categoryDef] of definition.categories.entries()) {
    const category = await prisma.storeCategory.create({
      data: { storeId: store.id, name: categoryDef.name, position: categoryIndex },
    });

    for (const productDef of categoryDef.products) {
      const baseUnit = unitByCode.get(productDef.baseUnit);
      // Toutes les unités employées ici figurent dans le profil du secteur ;
      // une définition mal orthographiée doit échouer bruyamment plutôt que
      // produire une démo silencieusement incohérente.
      if (!baseUnit) {
        throw new Error(
          `Démo ${definition.slug} : unité « ${productDef.baseUnit} » absente du secteur ${definition.businessType}.`,
        );
      }

      const declinations =
        productDef.variants && productDef.variants.length > 0
          ? productDef.variants
          : [{ attributes: {} as Record<string, string> }];

      const product = await prisma.storeProduct.create({
        data: {
          storeId: store.id,
          categoryId: category.id,
          name: productDef.name,
          status: 'ACTIVE',
          baseUnitId: baseUnit.id,
          variantAxes: (productDef.axes ?? []) as Prisma.InputJsonValue,
          supplierLeadDays: productDef.leadDays ?? null,
          // Ajusté plus bas, une fois le rythme de vente connu : un seuil
          // d'alerte qui ne tient pas compte de l'écoulement ne veut rien dire.
          minStockAlert: 0,
          variants: {
            create: declinations.map((variant, index) => ({
              sku: `${slugify(productDef.name)}-${index + 1}`.slice(0, 40),
              attributes: variant.attributes as Prisma.InputJsonValue,
              price: variant.price ?? productDef.price,
              cost: variant.cost ?? productDef.cost,
              isActive: true,
            })),
          },
        },
        include: { variants: true },
      });

      for (const [index, variant] of product.variants.entries()) {
        const declination = declinations[index]!;
        const price = declination.price ?? productDef.price;
        const cost = declination.cost ?? productDef.cost;

        const units: PoolUnit[] = [
          { id: baseUnit.id, label: baseUnit.label, factor: 1, price },
        ];
        const unitRows: Prisma.StoreVariantUnitCreateManyInput[] = [
          {
            productVariantId: variant.id,
            unitId: baseUnit.id,
            factor: 1,
            price,
            cost,
            isSellable: true,
            isPurchasable: true,
            position: 0,
          },
        ];

        for (const [packIndex, pack] of (productDef.packs ?? []).entries()) {
          const packUnit = unitByCode.get(pack.code);
          if (!packUnit) {
            throw new Error(
              `Démo ${definition.slug} : conditionnement « ${pack.code} » absent du secteur ${definition.businessType}.`,
            );
          }
          units.push({
            id: packUnit.id,
            label: packUnit.label,
            factor: pack.factor,
            price: pack.price,
          });
          unitRows.push({
            productVariantId: variant.id,
            unitId: packUnit.id,
            factor: pack.factor,
            price: pack.price,
            cost: pack.cost,
            isSellable: true,
            isPurchasable: true,
            position: packIndex + 1,
          });
        }

        await prisma.storeVariantUnit.createMany({ data: unitRows });

        const values = Object.values(declination.attributes).filter(Boolean);
        pool.push({
          variantId: variant.id,
          productId: product.id,
          productName: productDef.name,
          variantLabel: values.length > 0 ? values.join(' · ') : null,
          units,
          state: productDef.state ?? 'ok',
          leadDays: productDef.leadDays ?? 7,
          sold: 0,
        });
      }
    }
  }

  await prisma.storePromotion.create({
    data: {
      storeId: store.id,
      code: 'BIENVENUE10',
      type: 'PERCENT',
      value: 10,
      minCartAmount: 5000,
      endsAt: new Date(Date.now() + 60 * 86_400_000),
    },
  });

  const customers = await Promise.all(
    DEMO_CUSTOMERS.map((customer) =>
      prisma.storeCustomer.create({
        data: {
          storeId: store.id,
          name: customer.name,
          phone: customer.phone,
          email: `${customer.phone.replace(/\D/g, '')}@demo.magyapro.app`,
        },
      }),
    ),
  );

  // --- Planification des ventes ---------------------------------------------
  //
  // Les ventes sont d'abord planifiées, puis écrites dans l'ordre
  // chronologique : c'est la seule façon d'obtenir des quantités « avant » et
  // « après » justes dans les mouvements de stock.

  const sellable = pool.filter((entry) => entry.state !== 'dormant');
  const plans: Array<{ createdAt: Date; lines: PlannedLine[]; customerIndex: number | null }> = [];
  const saleCount = 40 + Math.floor(random() * 20);

  for (let i = 0; i < saleCount; i++) {
    const lines: PlannedLine[] = [];
    const picked = new Set<string>();
    const lineCount = 1 + Math.floor(random() * 3);

    for (let line = 0; line < lineCount; line++) {
      const entry = sellable[Math.floor(random() * sellable.length)];
      if (!entry || picked.has(entry.variantId)) continue;
      picked.add(entry.variantId);

      // Une vente au conditionnement de temps en temps : c'est ce qui rend
      // l'historique lisible pour montrer le moteur d'unités à l'œuvre.
      const usePack = entry.units.length > 1 && random() < 0.2;
      const unit = usePack ? entry.units[1]! : entry.units[0]!;
      const packs = usePack ? 1 : 1 + Math.floor(random() * 3);
      const quantity = round(packs * unit.factor);

      entry.sold = round(entry.sold + quantity);
      lines.push({ entry, unit, packs, quantity });
    }
    if (lines.length === 0) continue;

    const createdAt = daysAgo(random() * (HISTORY_DAYS - 3));
    createdAt.setHours(9 + Math.floor(random() * 10), Math.floor(random() * 60), 0, 0);

    plans.push({
      createdAt,
      lines,
      customerIndex: random() > 0.4 ? Math.floor(random() * customers.length) : null,
    });
  }

  plans.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // --- Stock initial déduit de l'état voulu ---------------------------------

  const stockOf = new Map<string, number>();
  const movements: Prisma.InventoryMovementCreateManyInput[] = [];
  const initialAt = daysAgo(HISTORY_DAYS);

  for (const entry of pool) {
    const daily = entry.sold / HISTORY_DAYS;
    // Seuil d'alerte : de quoi tenir le délai fournisseur plus quatre jours de
    // marge. C'est ce seuil qui rend l'état « stock faible » vérifiable à
    // l'écran plutôt qu'arbitraire.
    const alert = Math.max(2, Math.ceil(daily * (entry.leadDays + 4)));
    const finalStock = targetStock(entry.state, alert, daily, entry.leadDays, random);
    const initialStock = round(finalStock + entry.sold);

    stockOf.set(entry.variantId, initialStock);
    await prisma.storeProduct.updateMany({
      where: { id: entry.productId },
      data: { minStockAlert: alert },
    });

    if (initialStock > 0) {
      movements.push({
        storeId: store.id,
        productVariantId: entry.variantId,
        warehouseId: warehouse.id,
        type: 'INITIAL',
        quantityChange: initialStock,
        quantityBefore: 0,
        quantityAfter: initialStock,
        reason: 'Stock de départ (boutique de démonstration)',
        createdAt: initialAt,
      });
    }
  }

  // --- Écriture des ventes et de leurs mouvements ---------------------------

  let counter = 0;
  const customerTotals = new Map<string, { count: number; spent: number; lastAt: Date }>();

  for (const plan of plans) {
    counter += 1;
    const customer = plan.customerIndex === null ? null : customers[plan.customerIndex]!;

    const items = plan.lines.map((line) => ({
      productVariantId: line.entry.variantId,
      productName: line.entry.productName,
      variantLabel: line.entry.variantLabel,
      saleUnit: (line.unit.factor > 1 ? 'PACK' : 'UNIT') as 'PACK' | 'UNIT',
      quantity: line.quantity,
      unitId: line.unit.id,
      unitLabel: line.unit.label,
      unitFactor: line.unit.factor,
      unitPrice: line.unit.price,
      total: line.unit.price * line.packs,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const method = random() > 0.5 ? 'cash' : random() > 0.5 ? 'orange_money' : 'wave';

    const sale = await prisma.sale.create({
      data: {
        storeId: store.id,
        number: counter,
        customerId: customer?.id ?? null,
        subtotal,
        total: subtotal,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
        items: { create: items },
        payments: { create: { method, amount: subtotal } },
      },
      select: { id: true, total: true },
    });

    for (const line of plan.lines) {
      const before = stockOf.get(line.entry.variantId) ?? 0;
      const after = round(before - line.quantity);
      stockOf.set(line.entry.variantId, after);
      movements.push({
        storeId: store.id,
        productVariantId: line.entry.variantId,
        warehouseId: warehouse.id,
        type: 'SALE',
        quantityChange: -line.quantity,
        quantityBefore: before,
        quantityAfter: after,
        referenceType: 'sale',
        referenceId: sale.id,
        createdAt: plan.createdAt,
      });
    }

    if (customer) {
      const totals = customerTotals.get(customer.id) ?? {
        count: 0,
        spent: 0,
        lastAt: plan.createdAt,
      };
      totals.count += 1;
      totals.spent += sale.total;
      totals.lastAt = plan.createdAt;
      customerTotals.set(customer.id, totals);
    }
  }

  await prisma.inventory.createMany({
    data: pool.map((entry) => ({
      productVariantId: entry.variantId,
      warehouseId: warehouse.id,
      quantity: stockOf.get(entry.variantId) ?? 0,
    })),
  });

  await prisma.inventoryMovement.createMany({ data: movements });

  for (const [customerId, totals] of customerTotals) {
    await prisma.storeCustomer.update({
      where: { id: customerId },
      data: { salesCount: totals.count, totalSpent: totals.spent, lastSaleAt: totals.lastAt },
    });
  }

  await prisma.store.update({ where: { id: store.id }, data: { saleCounter: counter } });
}

/**
 * Stock final visé selon l'état voulu, en cohérence avec les règles de
 * `forecastStock` : c'est ce qui garantit qu'un produit annoncé « rupture
 * imminente » dans cette définition apparaît bien ainsi à l'écran.
 */
function targetStock(
  state: DemoState,
  alert: number,
  daily: number,
  leadDays: number,
  random: () => number,
): number {
  switch (state) {
    case 'out':
      return 0;
    case 'imminent':
      // Moins que le délai de livraison : la commande arriverait trop tard.
      return Math.max(1, Math.floor(daily * leadDays * 0.6));
    case 'low':
      // Au seuil d'alerte exactement, mais au-dessus du délai fournisseur.
      return alert;
    case 'dormant':
    case 'ok':
    default:
      return alert * (4 + Math.floor(random() * 4));
  }
}

/** Retire toutes les boutiques de démonstration (et leurs comptes propriétaires), sans toucher au reste. */
export async function cleanStoreDemos(): Promise<{ deletedStores: number; deletedUsers: number }> {
  const stores = await prisma.store.findMany({ where: { isDemo: true }, select: { id: true } });

  for (const store of stores) {
    await prisma.store.delete({ where: { id: store.id } });
  }

  const { count: deletedUsers } = await prisma.user.deleteMany({
    where: { isDemo: true, email: { endsWith: '@demo.magyapro.app' } },
  });

  return { deletedStores: stores.length, deletedUsers };
}

/**
 * Remet les boutiques de démonstration à neuf : suppression puis
 * recréation complète.
 *
 * Une démo se salit à l'usage — un visiteur encaisse, corrige un stock,
 * archive un produit. Sans cette action, la seule façon de repartir propre
 * était de supprimer puis semer en deux étapes, avec le risque d'oublier la
 * seconde et de laisser la vitrine publique sans aucune boutique d'exemple.
 *
 * Ne touche qu'aux boutiques `isDemo: true` : aucune donnée d'un vrai
 * commerçant n'est concernée.
 */
export async function resetStoreDemos(): Promise<{
  deletedStores: number;
  deletedUsers: number;
  created: string[];
}> {
  const removed = await cleanStoreDemos();
  const { created } = await seedStoreDemos();
  return { ...removed, created };
}
