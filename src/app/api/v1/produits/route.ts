import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireApiKeyStore } from '@/lib/boutique/api-auth';
import { toQty } from '@/lib/boutique/quantity';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const PAGE_SIZE = 100;

/** GET /api/v1/produits?page=1 — catalogue en lecture seule, paginé. */
export const GET = route(async (request) => {
  const store = await requireApiKeyStore(request);
  await hit(`api-v1:${store.id}`, RATE_LIMITS.apiPublic);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const [products, total] = await Promise.all([
    prisma.storeProduct.findMany({
      where: { storeId: store.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        unit: true,
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            barcode: true,
            price: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
    }),
    prisma.storeProduct.count({ where: { storeId: store.id, status: 'ACTIVE' } }),
  ]);

  return ok({
    page,
    pageSize: PAGE_SIZE,
    total,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category?.name ?? null,
      unit: product.unit,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        stock: variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0),
      })),
    })),
  });
});
