import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { formatQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { PrintButton } from '@/components/dashboard/print-button';

export const metadata: Metadata = { title: 'Facture' };
export const dynamic = 'force-dynamic';

async function nextInvoiceNumber(storeId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { storeId } });
  return `FAC-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Trouve la facture existante d'une vente, ou en crée une. Pas de route API
 * séparée : cette page fait le travail elle-même au chargement, comme un
 * « générer si absent ». La numérotation par comptage n'est pas garantie
 * sans collision sous forte concurrence (comme pour les bons de commande),
 * acceptable ici — en cas de course, la contrainte d'unicité rejette le
 * doublon et on relit simplement la facture entre-temps créée par l'autre
 * requête.
 */
async function findOrCreateInvoice(storeId: string, saleId: string, userId: string, userEmail: string) {
  const existing = await prisma.invoice.findUnique({ where: { saleId } });
  if (existing) return existing;

  const number = await nextInvoiceNumber(storeId);
  try {
    const invoice = await prisma.invoice.create({ data: { storeId, saleId, number } });
    await recordAudit({
      action: AUDIT_ACTIONS.STORE_INVOICE_CREATED,
      actorUserId: userId,
      actorEmail: userEmail,
      storeId,
      targetType: 'store_invoice',
      targetId: invoice.id,
      metadata: { saleId, number },
    });
    return invoice;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.invoice.findUnique({ where: { saleId } });
      if (raced) return raced;
    }
    throw error;
  }
}

export default async function BoutiqueInvoicePage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const context = await requireStore('sales:view');
  const { saleId } = await params;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId: context.store.id },
    include: { items: true, customer: true, payments: true },
  });
  if (!sale) notFound();

  const invoice = await findOrCreateInvoice(
    context.store.id,
    sale.id,
    context.user.id,
    context.user.email,
  );

  const store = context.store;
  const currency = store.currency;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-muted">Aperçu de la facture — imprimable ou exportable en PDF.</p>
        <PrintButton />
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink pb-4">
        <div>
          <p className="text-lg font-bold">{store.name}</p>
          {store.addressLine && <p className="text-sm text-ink-muted">{store.addressLine}</p>}
          {store.phone && <p className="text-sm text-ink-muted">{store.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Facture</p>
          <p className="text-lg font-bold">{invoice.number}</p>
          <p className="text-sm text-ink-muted">
            {invoice.issuedAt.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Vente n°{sale.number}</p>
        </div>
      </div>

      {sale.customer && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Client</p>
          <p className="mt-1 text-sm">{sale.customer.name}</p>
          {sale.customer.phone && <p className="text-sm text-ink-muted">{sale.customer.phone}</p>}
        </div>
      )}

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-ink-faint text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 font-medium">Article</th>
            <th className="py-2 text-right font-medium">Qté</th>
            <th className="py-2 text-right font-medium">Prix unitaire</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="border-b border-surface-border">
              <td className="py-2">
                {item.productName}
                {item.variantLabel && <span className="text-ink-muted"> · {item.variantLabel}</span>}
              </td>
              <td className="py-2 text-right">{formatQty(item.quantity)}</td>
              <td className="py-2 text-right">{formatMoney(item.unitPrice, currency)}</td>
              <td className="py-2 text-right">{formatMoney(item.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Sous-total</span>
          <span>{formatMoney(sale.subtotal, currency)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Remise</span>
            <span>−{formatMoney(sale.discount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-ink pt-1.5 text-base font-bold">
          <span>Total</span>
          <span>{formatMoney(sale.total, currency)}</span>
        </div>
        {sale.creditAmount > 0 && (
          <div className="flex justify-between text-xs text-ink-faint">
            <span>dont à crédit</span>
            <span>{formatMoney(sale.creditAmount, currency)}</span>
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">
        Généré par MagyaPro Boutique pour {store.name}
      </p>
    </div>
  );
}
