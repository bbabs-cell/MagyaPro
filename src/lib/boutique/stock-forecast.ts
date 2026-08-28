/**
 * Prévision des ruptures de stock — logique pure.
 *
 * Aucun accès base de données ici : ce module est importé par le tableau de
 * prévision, qui est un composant client. Y laisser un import Prisma ferait
 * entrer le pilote PostgreSQL dans le bundle navigateur. La lecture des
 * ventes vit à côté, dans `stock-velocity.ts`.
 *
 * Entièrement déterministe : moyennes, pondérations et divisions sur les
 * mouvements de stock réels de la boutique. Aucun service externe, aucune
 * clé d'API, aucun coût à la requête — la même entrée donne toujours la même
 * sortie, et le commerçant peut refaire le calcul de tête s'il le souhaite.
 *
 * Le principe tient en une division :
 *
 *     jours avant rupture = stock disponible / ventes moyennes par jour
 *
 * Tout le reste consiste à estimer honnêtement ce dénominateur, et à dire
 * quand on ne peut pas l'estimer.
 */

/** Fenêtre d'observation longue — assez pour lisser un jour de marché exceptionnel. */
export const LONG_WINDOW_DAYS = 30;
/** Fenêtre courte — capte un changement de rythme récent. */
export const SHORT_WINDOW_DAYS = 7;
/**
 * En dessous, l'historique est trop mince pour une moyenne pondérée : on se
 * contente de la moyenne simple, et le résultat est annoncé comme approximatif.
 */
export const MIN_DAYS_FOR_TREND = 14;
/** Couverture visée à la commande, en plus du délai fournisseur. */
const DEFAULT_COVER_DAYS = 14;

export type StockLevel = 'ok' | 'low' | 'imminent' | 'out';

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  ok: 'Stock normal',
  low: 'Stock faible',
  imminent: 'Rupture imminente',
  out: 'Rupture',
};

/**
 * Icône associée à chaque niveau. Le cahier des charges l'exige : la couleur
 * seule exclut les personnes qui la distinguent mal, et disparaît à
 * l'impression en noir et blanc.
 */
export const STOCK_LEVEL_ICONS: Record<StockLevel, string> = {
  ok: '✓',
  low: '!',
  imminent: '‼',
  out: '✕',
};

export type StockForecast = {
  level: StockLevel;
  /** Stock actuel, en unité de base. */
  stock: number;
  /** Ventes moyennes par jour, en unité de base. `0` si aucune vente observée. */
  dailySales: number;
  /**
   * Jours avant rupture au rythme actuel. `null` quand aucune vente n'a été
   * observée : sans consommation, la question n'a pas de réponse — mieux vaut
   * l'admettre qu'afficher « l'infini ».
   */
  daysLeft: number | null;
  /** Quantité à commander pour couvrir le délai fournisseur puis la période suivante. */
  recommendedQuantity: number;
  /** Jours d'historique réellement observés — sert à nuancer l'affichage. */
  observedDays: number;
  /** Faux quand l'historique est trop court pour une tendance fiable. */
  reliable: boolean;
};

/**
 * Établit la prévision d'une variante à partir de son stock et de son rythme
 * de vente. Fonction pure : testable sans base de données.
 */
export function forecastStock(params: {
  stock: number;
  dailySales: number;
  minStockAlert: number;
  /** Délai fournisseur en jours. `null` = inconnu, la rupture imminente n'est alors pas évaluée. */
  supplierLeadDays: number | null;
  maxStock: number | null;
  observedDays?: number;
  reliable?: boolean;
}): StockForecast {
  const { stock, dailySales, minStockAlert, supplierLeadDays, maxStock } = params;

  const daysLeft = dailySales > 0 ? round(stock / dailySales) : null;

  let level: StockLevel;
  if (stock <= 0) {
    level = 'out';
  } else if (
    // Imminent : le stock ne tiendra pas jusqu'à la livraison. C'est le seul
    // niveau qui tienne compte du délai fournisseur — sans lui, « il reste
    // 3 jours » ne dit pas s'il faut s'inquiéter.
    daysLeft !== null &&
    supplierLeadDays !== null &&
    daysLeft <= supplierLeadDays
  ) {
    level = 'imminent';
  } else if (minStockAlert > 0 && stock <= minStockAlert) {
    level = 'low';
  } else if (daysLeft !== null && daysLeft <= SHORT_WINDOW_DAYS && supplierLeadDays === null) {
    // Sans délai fournisseur renseigné, moins d'une semaine de couverture
    // reste une alerte utile — simplement moins précise.
    level = 'low';
  } else {
    level = 'ok';
  }

  // Couvrir le délai de livraison, puis la période qui suit — sinon la
  // commande arrive juste pour être aussitôt épuisée.
  const coverDays = (supplierLeadDays ?? 0) + DEFAULT_COVER_DAYS;
  const target = maxStock ?? dailySales * coverDays;
  const recommendedQuantity = dailySales > 0 ? Math.max(0, round(target - stock)) : 0;

  return {
    level,
    stock: round(stock),
    dailySales: round(dailySales),
    daysLeft,
    recommendedQuantity,
    observedDays: params.observedDays ?? 0,
    reliable: params.reliable ?? false,
  };
}

/** Arrondi à deux décimales — au-delà, une prévision affiche une fausse précision. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
