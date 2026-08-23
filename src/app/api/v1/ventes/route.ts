import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireApiKeyStore } from '@/lib/boutique/api-auth';
import { toQty } from '@/lib/boutique/quantity';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const PAGE_SIZE = 100;

/**
 * GET /api/v1/ventes?page=1&du=2026-08-01&au=2026-08-31 — historique des
 * ventes en lecture seule, paginé, filtrable par date.
 */
export const GET = route(async (request) => {
  const store = await requireApiKeyStore(request);
  hit(`api-v1:${store.id}`, RATE_LIMITS.apiPublic);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const du = url.searchParams.get('du');
  const au = url.searchParams.get('au');

  const where = {
    storeId: store.id,
    ...((du || au) && {
      createdAt: {
        ...(du && { gte: new Date(`${du}T00:00:00`) }),
        ...(au && { lte: new Date(`${au}T23:59:59.999`) }),
      },
    }),
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        createdAt: true,
        status: true,
        subtotal: true,
        discount: true,
        taxAmount: true,
        total: true,
        items: { select: { productName: true, quantity: true, unitPrice: true, total: true } },
        payments: { select: { method: true, amount: true } },
      },
    }),
    prisma.sale.count({ where }),
  ]);

  return ok({
    page,
    pageSize: PAGE_SIZE,
    total,
    sales: sales.map((sale) => ({
      id: sale.id,
      number: sale.number,
      createdAt: sale.createdAt.toISOString(),
      status: sale.status,
      subtotal: sale.subtotal,
      discount: sale.discount,
      taxAmount: sale.taxAmount,
      total: sale.total,
      items: sale.items.map((item) => ({
        productName: item.productName,
        quantity: toQty(item.quantity),
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      payments: sale.payments,
    })),
  });
});
