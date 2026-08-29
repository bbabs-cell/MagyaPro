import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';
import { parseVariantAxes, variantLabel } from '@/lib/boutique/variants';

/**
 * Analyses automatiques de la boutique.
 *
 * Tout est calculé à partir des données déjà en base — ventes encaissées,
 * fiches produits, stock. Aucun service externe, aucune clé d'API, aucun
 * modèle statistique opaque : ce sont des sommes, des différences et des
 * divisions, que le commerçant peut refaire à la main sur un carnet.
 *
 * Deux honnêtetés assumées dans ce fichier :
 *
 * 1. La marge est calculée au coût d'achat ACTUEL de la fiche, pas au coût du
 *    jour de la vente — `SaleItem` ne fige pas le coût. Sur un produit dont le
 *    prix d'achat a bougé, la marge passée est donc approchée. C'est indiqué à
 *    l'écran plutôt que masqué.
 * 2. Un produit sans coût d'achat renseigné est exclu des marges, jamais
 *    compté à marge de 100 %. Leur nombre est remonté pour que le commerçant
 *    sache ce qui manque.
 */

/** Sans vente depuis ce délai, un produit en stock est considéré dormant. */
export const DORMANT_DAYS = 60;
/** Fenêtre d'analyse des marges et des tendances. */
export const TREND_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Les ventes annulées ne comptent ni en revenu, ni en volume, ni en marge. */
const COUNTED_SALES = { status: { not: 'CANCELLED' as const } };

export type StockValue = {
  /** Capital immobilisé : stock × coût d'achat. */
  cost: number;
  /** Valeur au prix de vente : stock × prix. */
  retail: number;
  /** Marge potentielle si tout le stock était vendu au prix affiché. */
  potentialMargin: number;
  /** Nombre de références (variantes) en stock. */
  references: number;
  /** Variantes sans coût d'achat renseigné — exclues du capital immobilisé. */
  missingCost: number;
};

export type DormantProduct = {
  variantId: string;
  productId: string;
  name: string;
  label: string | null;
  stock: number;
  /** Capital immobilisé sur cette variante. */
  capital: number;
  lastSaleAt: Date | null;
  /** Jours depuis la dernière vente. `null` = jamais vendue. */
  daysSinceSale: number | null;
};

export type MarginRow = {
  variantId: string;
  name: string;
  label: string | null;
  /** Quantité vendue sur la période, en unité de base. */
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  /** Marge en pourcentage du chiffre d'affaires. */
  marginRate: number;
};

export type Trend = {
  current: number;
  previous: number;
  /** Variation en pourcentage. `null` quand la période précédente est vide. */
  change: number | null;
};

export type StoreInsights = {
  stockValue: StockValue;
  dormant: DormantProduct[];
  /** Combien de variantes dormantes au total (la liste est tronquée). */
  dormantCount: number;
  /** Capital immobilisé par TOUTES les références dormantes, pas seulement
   *  celles affichées — c'est le chiffre qui donne l'ampleur du problème. */
  dormantCapital: number;
  bestMargins: MarginRow[];
  worstMargins: MarginRow[];
  /** Produits vendus en dessous de leur coût d'achat — à corriger en priorité. */
  losses: MarginRow[];
  revenue: Trend;
  profit: Trend;
  unitsSold: Trend;
  /** Variantes vendues sur la période dont le coût manque : marge non calculable. */
  marginCoverageMissing: number;
};

export async function getStoreInsights(
  storeId: string,
  options: { dormantDays?: number; trendDays?: number } = {},
): Promise<StoreInsights> {
  const dormantDays = options.dormantDays ?? DORMANT_DAYS;
  const trendDays = options.trendDays ?? TREND_DAYS;

  const now = Date.now();
  const trendFrom = new Date(now - trendDays * DAY_MS);
  const previousFrom = new Date(now - 2 * trendDays * DAY_MS);
  const dormantBefore = new Date(now - dormantDays * DAY_MS);

  const [variants, lastSales, currentItems, previousItems] = await Promise.all([
    prisma.storeProductVariant.findMany({
      // Les fiches archivées sont exclues : le commerçant les a déjà retirées
      // volontairement, les signaler comme « dormantes » serait du bruit.
      where: { isActive: true, product: { storeId, status: { not: 'ARCHIVED' } } },
      select: {
        id: true,
        cost: true,
        price: true,
        attributes: true,
        product: { select: { id: true, name: true, variantAxes: true } },
        inventory: { select: { quantity: true } },
      },
    }),
    // Dernière vente par variante. Passer par les mouvements de stock plutôt
    // que par les lignes de vente : `InventoryMovement` porte une date propre
    // et un index `(productVariantId, createdAt)`, là où `SaleItem` obligerait
    // à joindre puis trier tout l'historique des ventes.
    prisma.inventoryMovement.groupBy({
      by: ['productVariantId'],
      where: { storeId, type: 'SALE' },
      _max: { createdAt: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: { storeId, createdAt: { gte: trendFrom }, ...COUNTED_SALES } },
      select: { productVariantId: true, productName: true, variantLabel: true, quantity: true, total: true },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: { storeId, createdAt: { gte: previousFrom, lt: trendFrom }, ...COUNTED_SALES },
      },
      select: { productVariantId: true, quantity: true, total: true },
    }),
  ]);

  const costOf = new Map<string, number>();
  for (const variant of variants) costOf.set(variant.id, variant.cost);

  // ---- Valeur du stock -----------------------------------------------------

  const stockValue: StockValue = {
    cost: 0,
    retail: 0,
    potentialMargin: 0,
    references: 0,
    missingCost: 0,
  };

  const stockOf = new Map<string, number>();
  for (const variant of variants) {
    const stock = variant.inventory.reduce((sum, entry) => sum + toQty(entry.quantity), 0);
    stockOf.set(variant.id, stock);
    if (stock <= 0) continue;
    stockValue.references += 1;
    stockValue.retail += Math.round(stock * variant.price);
    if (variant.cost > 0) {
      stockValue.cost += Math.round(stock * variant.cost);
    } else {
      stockValue.missingCost += 1;
    }
  }
  stockValue.potentialMargin = stockValue.retail - stockValue.cost;

  // ---- Produits dormants ---------------------------------------------------

  const lastSaleOf = new Map<string, Date>();
  for (const row of lastSales) {
    if (row._max.createdAt) lastSaleOf.set(row.productVariantId, row._max.createdAt);
  }

  const dormantAll: DormantProduct[] = [];
  for (const variant of variants) {
    const stock = stockOf.get(variant.id) ?? 0;
    // Un produit sans stock n'immobilise rien : ne pas le vendre n'est pas un
    // problème d'argent qui dort, c'est simplement une fiche inutilisée.
    if (stock <= 0) continue;
    const lastSaleAt = lastSaleOf.get(variant.id) ?? null;
    if (lastSaleAt && lastSaleAt >= dormantBefore) continue;

    const axes = parseVariantAxes(variant.product.variantAxes);
    dormantAll.push({
      variantId: variant.id,
      productId: variant.product.id,
      name: variant.product.name,
      label: variantLabel((variant.attributes ?? {}) as Record<string, string>, axes),
      stock,
      capital: Math.round(stock * variant.cost),
      lastSaleAt,
      daysSinceSale: lastSaleAt ? Math.floor((now - lastSaleAt.getTime()) / DAY_MS) : null,
    });
  }
  // Le capital immobilisé d'abord : c'est l'argent qu'il faut débloquer en
  // premier, pas la référence la plus anciennement vendue.
  dormantAll.sort((a, b) => b.capital - a.capital || (b.daysSinceSale ?? 1e9) - (a.daysSinceSale ?? 1e9));

  // ---- Marges par produit --------------------------------------------------

  type Aggregate = { name: string; label: string | null; quantity: number; revenue: number };
  const byVariant = new Map<string, Aggregate>();
  let currentRevenue = 0;
  let currentUnits = 0;
  let currentCost = 0;
  const missingCostVariants = new Set<string>();

  for (const item of currentItems) {
    const quantity = toQty(item.quantity);
    currentRevenue += item.total;
    currentUnits += quantity;

    const cost = costOf.get(item.productVariantId);
    if (cost && cost > 0) currentCost += Math.round(quantity * cost);
    else if (cost !== undefined) missingCostVariants.add(item.productVariantId);

    const entry = byVariant.get(item.productVariantId) ?? {
      name: item.productName,
      label: item.variantLabel,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += quantity;
    entry.revenue += item.total;
    byVariant.set(item.productVariantId, entry);
  }

  let previousRevenue = 0;
  let previousUnits = 0;
  let previousCost = 0;
  for (const item of previousItems) {
    const quantity = toQty(item.quantity);
    previousRevenue += item.total;
    previousUnits += quantity;
    const cost = costOf.get(item.productVariantId);
    if (cost && cost > 0) previousCost += Math.round(quantity * cost);
  }

  const margins: MarginRow[] = [];
  for (const [variantId, entry] of byVariant) {
    const unitCost = costOf.get(variantId) ?? 0;
    // Sans coût d'achat, la marge serait mécaniquement de 100 % : mieux vaut
    // ne rien afficher que d'afficher un chiffre flatteur et faux.
    if (unitCost <= 0 || entry.revenue <= 0) continue;
    const cost = Math.round(entry.quantity * unitCost);
    const margin = entry.revenue - cost;
    margins.push({
      variantId,
      name: entry.name,
      label: entry.label,
      quantity: round(entry.quantity),
      revenue: entry.revenue,
      cost,
      marginRate: Math.round((margin / entry.revenue) * 1000) / 10,
      margin,
    });
  }

  const ranked = [...margins].sort((a, b) => b.marginRate - a.marginRate);
  const profitable = ranked.filter((row) => row.margin >= 0);
  // Avec moins d'une quinzaine de références vendues, un « top » et un « flop »
  // afficheraient les mêmes lignes deux fois : on ne montre alors qu'un
  // classement unique.
  const splitRankings = profitable.length >= 12;

  return {
    stockValue,
    dormant: dormantAll.slice(0, 20),
    dormantCount: dormantAll.length,
    dormantCapital: dormantAll.reduce((sum, row) => sum + row.capital, 0),
    bestMargins: profitable.slice(0, splitRankings ? 8 : 12),
    worstMargins: splitRankings ? profitable.slice(-8).reverse() : [],
    losses: ranked.filter((row) => row.margin < 0).sort((a, b) => a.margin - b.margin),
    revenue: trend(previousRevenue, currentRevenue),
    profit: trend(previousRevenue - previousCost, currentRevenue - currentCost),
    unitsSold: trend(round(previousUnits), round(currentUnits)),
    marginCoverageMissing: missingCostVariants.size,
  };
}

function trend(previous: number, current: number): Trend {
  return {
    current,
    previous,
    // Une variation par rapport à zéro n'a pas de valeur : « +∞ % » ne dit
    // rien de plus que « il n'y avait rien avant ».
    change: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
