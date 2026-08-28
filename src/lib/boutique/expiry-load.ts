import { prisma } from '@/lib/db';

/**
 * Lecture des dates de péremption, côté serveur uniquement.
 *
 * Séparé de `expiry.ts`, qui reste pur et importable depuis un composant
 * client : sans cette séparation, afficher une simple pastille « Périmé »
 * ferait entrer le pilote PostgreSQL dans le bundle navigateur.
 */

/**
 * Date de péremption la plus proche par déclinaison, pour toute la boutique.
 *
 * Une seule requête groupée : interroger lot par lot rendrait la page
 * Produits inutilisable dès quelques centaines de références.
 *
 * Seuls les lots qu'il reste vraiment à écouler comptent
 * (`remainingQuantity > 0`) : un lot périmé mais entièrement vendu ou retiré
 * n'a plus à faire clignoter la fiche.
 */
export async function loadEarliestExpiry(storeId: string): Promise<Map<string, Date>> {
  const rows = await prisma.stockBatch.groupBy({
    by: ['productVariantId'],
    where: { storeId, remainingQuantity: { gt: 0 } },
    _min: { expiryDate: true },
  });

  const result = new Map<string, Date>();
  for (const row of rows) {
    if (row._min.expiryDate) result.set(row.productVariantId, row._min.expiryDate);
  }
  return result;
}
