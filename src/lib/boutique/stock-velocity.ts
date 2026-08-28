import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';
import { LONG_WINDOW_DAYS, MIN_DAYS_FOR_TREND, SHORT_WINDOW_DAYS } from '@/lib/boutique/stock-forecast';

/**
 * Lecture des ventes passées, côté serveur uniquement.
 *
 * Séparé de `stock-forecast.ts`, qui reste pur et importable depuis un
 * composant client : sans cette séparation, afficher un simple libellé de
 * niveau de stock embarquerait Prisma dans le navigateur.
 */

/**
 * Ventes quotidiennes moyennes par variante, sur la fenêtre longue.
 *
 * Une seule requête groupée pour tout le catalogue : calculer produit par
 * produit rendrait la page de prévision inutilisable dès quelques centaines
 * de références.
 *
 * Les sorties comptabilisées sont uniquement les ventes (`SALE`) : une perte,
 * une casse ou un transfert ne disent rien de la demande des clients et
 * gonfleraient artificiellement la vitesse d'écoulement.
 */
export async function loadSalesVelocity(
  storeId: string,
): Promise<Map<string, { daily: number; observedDays: number; reliable: boolean }>> {
  const now = Date.now();
  const longSince = new Date(now - LONG_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const shortSince = new Date(now - SHORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const movements = await prisma.inventoryMovement.findMany({
    where: { storeId, type: 'SALE', createdAt: { gte: longSince } },
    select: { productVariantId: true, quantityChange: true, createdAt: true },
  });

  const byVariant = new Map<
    string,
    { longTotal: number; shortTotal: number; firstSeen: number }
  >();

  for (const movement of movements) {
    // `quantityChange` est négatif pour une sortie : on raisonne en volume vendu.
    const sold = Math.abs(toQty(movement.quantityChange));
    const at = movement.createdAt.getTime();
    const entry = byVariant.get(movement.productVariantId) ?? {
      longTotal: 0,
      shortTotal: 0,
      firstSeen: at,
    };
    entry.longTotal += sold;
    if (movement.createdAt >= shortSince) entry.shortTotal += sold;
    entry.firstSeen = Math.min(entry.firstSeen, at);
    byVariant.set(movement.productVariantId, entry);
  }

  const result = new Map<string, { daily: number; observedDays: number; reliable: boolean }>();

  for (const [variantId, entry] of byVariant) {
    // Un produit vendu pour la première fois hier ne doit pas voir sa moyenne
    // divisée par 30 : on ne divise que par les jours réellement observés.
    const observedDays = Math.max(
      1,
      Math.min(LONG_WINDOW_DAYS, Math.ceil((now - entry.firstSeen) / (24 * 60 * 60 * 1000))),
    );
    const longDaily = entry.longTotal / observedDays;
    const shortDaily = entry.shortTotal / Math.min(SHORT_WINDOW_DAYS, observedDays);

    const reliable = observedDays >= MIN_DAYS_FOR_TREND;
    // Avec assez de recul, le rythme récent pèse davantage : un produit qui
    // s'accélère doit être réapprovisionné sur sa tendance, pas sur sa moyenne
    // du mois. Sans ce recul, la moyenne simple reste plus prudente.
    const daily = reliable ? shortDaily * 0.6 + longDaily * 0.4 : longDaily;

    result.set(variantId, { daily: round(daily), observedDays, reliable });
  }

  return result;
}

/** Arrondi à deux décimales — au-delà, une vitesse affiche une fausse précision. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
