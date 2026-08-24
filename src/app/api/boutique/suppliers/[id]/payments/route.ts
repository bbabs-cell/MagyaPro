import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { addSupplierPayment } from '@/lib/boutique/purchases-service';
import { storeSupplierPaymentSchema } from '@/lib/validation';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

/** Historique des paiements versés à ce fournisseur. */
export const GET = route(async (_request, { params }: Params) => {
  const { store } = await requireStore('purchases:view');
  const { id } = await params;

  const payments = await prisma.supplierPayment.findMany({
    where: { supplierId: id, storeId: store.id },
    orderBy: { paidAt: 'desc' },
    include: { purchaseOrder: { select: { reference: true } } },
  });

  return ok({ payments });
});

/** Enregistre un paiement au fournisseur — solde tout ou partie de sa dette. */
export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  await hit(`boutique-supplier-payment:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  const input = parseOrThrow(storeSupplierPaymentSchema, await readJson(request));

  const payment = await addSupplierPayment({
    storeId: context.store.id,
    userId: context.user.id,
    userEmail: context.user.email,
    supplierId: id,
    input,
  });

  return ok({ payment }, 201);
});
