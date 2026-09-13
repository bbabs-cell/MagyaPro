import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatQty } from '@/lib/boutique/quantity';
import { paymentMethodLabel } from '@/lib/boutique/labels';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { PrintButton } from '@/components/dashboard/print-button';
import {
  DocumentFooter,
  DocumentHeader,
  DocumentLines,
  DocumentParty,
  DocumentPayments,
  DocumentToolbar,
  DocumentTotals,
} from '@/components/documents';

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
      <DocumentToolbar hint="Aperçu de la facture — imprimable ou exportable en PDF.">
        <PrintButton />
      </DocumentToolbar>

      <DocumentHeader
        issuer={{
          name: store.name,
          logoUrl: store.logoUrl,
          addressLine: store.addressLine,
          city: store.city,
          phone: store.phone,
          taxId: store.legalId,
        }}
        kind="Facture"
        number={invoice.number}
        date={invoice.issuedAt}
        subline={`Vente n°${sale.number}`}
      />

      {sale.customer && (
        <DocumentParty
          label="Client"
          name={sale.customer.name}
          lines={[sale.customer.phone]}
        />
      )}

      <DocumentLines
        currency={currency}
        lines={sale.items.map((item) => ({
          id: item.id,
          label: item.productName,
          detail: item.variantLabel,
          quantity: formatQty(item.quantity),
          unitPrice: item.unitPrice,
          total: item.total,
        }))}
      />

      <DocumentTotals
        currency={currency}
        total={sale.total}
        rows={[
          { label: 'Sous-total', amount: sale.subtotal },
          ...(sale.discount > 0
            ? [{ label: 'Remise', amount: sale.discount, negative: true }]
            : []),
          ...(sale.taxAmount > 0 ? [{ label: 'TVA', amount: sale.taxAmount }] : []),
        ]}
      />

      <DocumentPayments
        currency={currency}
        remaining={sale.creditAmount}
        emptyLabel="Aucun règlement enregistré pour cette vente."
        payments={sale.payments.map((payment) => ({
          id: payment.id,
          label: paymentMethodLabel(payment.method),
          detail: payment.reference,
          amount: payment.amount,
        }))}
      />

      <DocumentFooter issuerName={store.name} />
    </div>
  );
}
