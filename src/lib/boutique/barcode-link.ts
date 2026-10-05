import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * Associe un code-barres à une déclinaison de la boutique `storeId` — voir
 * `POST /api/boutique/products/barcode`, qui l'appelle depuis la caisse.
 *
 * - La déclinaison est cherchée **dans cette boutique** : hors de celle-ci,
 *   elle « n'existe pas » (404), sans dire qu'elle existe ailleurs.
 * - Un code ne désigne qu'un article par boutique (sans tenir compte de la
 *   casse) : sinon le scan ajouterait l'un ou l'autre au hasard. Le même
 *   code dans une **autre** boutique n'est pas un conflit — deux commerces
 *   vendent le même article.
 */
export async function linkVariantBarcode(storeId: string, variantId: string, barcode: string) {
  const variant = await prisma.storeProductVariant.findFirst({
    where: { id: variantId, product: { storeId } },
    select: { id: true, productId: true, barcode: true },
  });
  if (!variant) throw new NotFoundError('Produit introuvable.');

  const taken = await prisma.storeProductVariant.findFirst({
    where: {
      barcode: { equals: barcode, mode: 'insensitive' },
      product: { storeId },
      NOT: { id: variant.id },
    },
    select: { product: { select: { name: true } } },
  });
  if (taken) {
    throw new ConflictError(`Ce code-barres est déjà associé à « ${taken.product.name} ».`);
  }

  await prisma.storeProductVariant.update({ where: { id: variant.id }, data: { barcode } });
  return { variantId: variant.id, productId: variant.productId, previousBarcode: variant.barcode };
}
