import { prisma } from '@/lib/db';
import { paymentMethodLabel } from '@/lib/boutique/labels';
import { buildTicket, type TicketData } from '@/lib/boutique/ticket';

type StoreForTicket = {
  id: string;
  name: string;
  currency: string;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  legalId: string | null;
};

/**
 * Ticket d'une vente de la boutique, pour une réimpression. `null` si la vente
 * n'existe pas ou appartient à une autre boutique — jamais de distinction
 * entre les deux.
 */
export async function loadSaleTicket(store: StoreForTicket, saleId: string): Promise<TicketData | null> {
  const [sale, methods] = await Promise.all([
    prisma.sale.findFirst({
      where: { id: saleId, storeId: store.id },
      select: {
        number: true,
        createdAt: true,
        subtotal: true,
        discount: true,
        taxAmount: true,
        total: true,
        creditAmount: true,
        items: {
          orderBy: { id: 'asc' },
          select: {
            productName: true,
            variantLabel: true,
            quantity: true,
            unitLabel: true,
            unitFactor: true,
            unitPrice: true,
            total: true,
          },
        },
        payments: { select: { method: true, amount: true } },
        customer: { select: { name: true } },
      },
    }),
    // Tous les moyens, même désactivés depuis : une vente ancienne garde le
    // libellé que la boutique leur donnait.
    prisma.storePaymentMethod.findMany({
      where: { storeId: store.id },
      select: { method: true, label: true },
    }),
  ]);
  if (!sale) return null;

  const labels = new Map(methods.map((method) => [method.method, method.label]));
  return buildTicket({
    store: {
      name: store.name,
      addressLine: store.addressLine,
      city: store.city,
      phone: store.phone,
      legalId: store.legalId,
    },
    sale,
    currency: store.currency,
    paymentLabel: (method) => labels.get(method) ?? paymentMethodLabel(method),
  });
}
