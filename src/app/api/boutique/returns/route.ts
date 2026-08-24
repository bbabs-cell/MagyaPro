import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { createReturn } from '@/lib/boutique/returns-service';
import { storeReturnSchema } from '@/lib/validation';

export const GET = route(async () => {
  const { store } = await requireStore('sales:view');

  const returns = await prisma.storeReturn.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      sale: { select: { number: true } },
      items: { select: { productVariantId: true, quantity: true, unitPrice: true } },
    },
  });

  return ok({ returns });
});

/**
 * Traité en une seule étape (pas de workflow d'approbation séparé) : le
 * stock est ré-approvisionné et, pour une vente à crédit, le solde du
 * client réduit d'autant — sans quoi il resterait à devoir pour des
 * articles qu'il a rendus.
 *
 * Non géré dans cette version : l'impact sur la caisse (une remise en
 * espèces n'est pas tracée comme mouvement de caisse) — limitation connue,
 * pas simulée.
 */
export const POST = route(async (request) => {
  const context = await requireStore('sales:refund');
  const input = parseOrThrow(storeReturnSchema, await readJson(request));

  const created = await createReturn({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    input,
  });

  return ok({ return: created }, 201);
});
