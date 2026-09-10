import type { Prisma, SaleStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';

/**
 * Journal des ventes, filtrable et paginé.
 *
 * L'écran Ventes affichait les cent dernières et rien d'autre : ni recherche,
 * ni période, ni moyen d'atteindre la cent unième. Retrouver la vente d'un
 * client venu se plaindre la semaine dernière était impossible — c'est
 * pourtant la raison principale d'ouvrir cet écran, avec l'édition d'une
 * facture et l'enregistrement d'un retour.
 *
 * Même mécanique que `listStockMovements` : le filtre vit dans l'URL, la page
 * fonctionne sans JavaScript, et le total affiché est celui de la sélection
 * courante et non des seules lignes visibles. Un commerçant qui filtre sur
 * hier veut le chiffre d'hier, pas la somme de la première page.
 */

export const SALES_PAGE_SIZE = 40;

/** Les ventes annulées ne comptent pas dans le chiffre d'affaires de la sélection. */
const REVENUE_STATUSES: SaleStatus[] = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

export async function listStoreSales(
  storeId: string,
  options: {
    status?: SaleStatus;
    /** Numéro de vente, ou nom de produit contenu dans la vente. */
    search?: string;
    from?: string;
    to?: string;
    page?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);

  // Le filtre de tenant ouvre la clause et n'est jamais surchargé ensuite :
  // aucune combinaison de filtres ne peut faire sortir une vente d'une autre
  // boutique.
  const where: Prisma.SaleWhereInput = { storeId };

  if (options.status) where.status = options.status;

  if (options.from || options.to) {
    where.createdAt = {
      ...(options.from ? { gte: new Date(`${options.from}T00:00:00`) } : {}),
      // Borne haute inclusive : saisir le 12 doit inclure toute la journée du
      // 12, pas s'arrêter à minuit pile.
      ...(options.to ? { lte: new Date(`${options.to}T23:59:59.999`) } : {}),
    };
  }

  if (options.search) {
    const term = options.search.trim();
    const asNumber = Number.parseInt(term, 10);
    where.OR = [
      // Un commerçant qui tape « 412 » cherche la vente n°412, pas un produit
      // dont le nom contient 412.
      ...(Number.isFinite(asNumber) && String(asNumber) === term ? [{ number: asNumber }] : []),
      { items: { some: { productName: { contains: term, mode: 'insensitive' as const } } } },
    ];
  }

  const [rows, total, revenue] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * SALES_PAGE_SIZE,
      take: SALES_PAGE_SIZE,
      include: {
        items: {
          select: {
            productVariantId: true,
            productName: true,
            variantLabel: true,
            quantity: true,
            unitPrice: true,
          },
        },
        payments: { select: { method: true } },
        returns: { include: { items: { select: { productVariantId: true, quantity: true } } } },
      },
    }),
    prisma.sale.count({ where }),
    // Chiffre d'affaires de la sélection entière, pas de la page affichée.
    prisma.sale.aggregate({
      where: { ...where, status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
    }),
  ]);

  return {
    rows: rows.map((sale) => {
      const returnedByVariant: Record<string, number> = {};
      for (const storeReturn of sale.returns) {
        for (const item of storeReturn.items) {
          returnedByVariant[item.productVariantId] =
            (returnedByVariant[item.productVariantId] ?? 0) + toQty(item.quantity);
        }
      }

      return {
        id: sale.id,
        number: sale.number,
        createdAt: sale.createdAt.toISOString(),
        status: sale.status,
        total: sale.total,
        items: sale.items.map((item) => ({ ...item, quantity: toQty(item.quantity) })),
        payments: sale.payments,
        returnedByVariant,
      };
    }),
    total,
    revenue: revenue._sum.total ?? 0,
    pageCount: Math.max(1, Math.ceil(total / SALES_PAGE_SIZE)),
    page,
  };
}
