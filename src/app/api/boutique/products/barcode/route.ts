import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeBarcodeLinkSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { linkVariantBarcode } from '@/lib/boutique/barcode-link';

/**
 * Associe un code-barres à un produit, depuis la caisse.
 *
 * C'est ce qui manquait pour que le scanner serve vraiment : un commerce
 * démarre avec des fiches sans code-barres, et chaque scan répondait
 * « code inconnu ». Il fallait quitter la caisse, ouvrir la fiche du produit
 * et recopier treize chiffres. Désormais un code inconnu se rattache au
 * produit en deux gestes, et il est reconnu dès le scan suivant.
 *
 * Mêmes droits que la fiche produit (`products:manage`) : un caissier sans
 * ce droit voit le code inconnu, mais ne peut pas changer le catalogue.
 *
 * La boutique est celle de la session, jamais une boutique envoyée par le
 * client ; les contrôles sont dans `linkVariantBarcode`.
 */
export const POST = route(async (request) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-products:${context.store.id}`, RATE_LIMITS.write);
  const input = parseOrThrow(storeBarcodeLinkSchema, await readJson(request));

  const linked = await linkVariantBarcode(context.store.id, input.variantId, input.barcode);

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PRODUCT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_product',
    targetId: linked.productId,
    metadata: { barcode: input.barcode, previousBarcode: linked.previousBarcode, via: 'caisse' },
  });

  return ok({ variantId: linked.variantId, barcode: input.barcode });
});
