import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { loadSaleTicket } from '@/lib/boutique/ticket-load';
import { ticketPrintRows, type TicketWidth } from '@/lib/boutique/ticket';
import { TicketPrintControls } from '@/components/boutique/ticket-print-controls';

export const metadata: Metadata = { title: 'Ticket de caisse' };
export const dynamic = 'force-dynamic';

/**
 * Ticket de caisse au format rouleau, pour l'imprimante installée sur
 * l'appareil (USB sur ordinateur, application d'impression sur téléphone).
 *
 * Le contenu est exactement celui envoyé en Bluetooth (`ticketPrintRows`), en
 * police à chasse fixe : les colonnes tombent juste quelle que soit
 * l'imprimante. Taille du caractère : la largeur imprimable (48 ou 72 mm)
 * divisée par le nombre de colonnes, qui donne 2,5 mm dans les deux cas.
 */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ largeur?: string; imprimer?: string }>;
}) {
  const context = await requireStore('sales:view');
  const { saleId } = await params;
  const query = await searchParams;
  const width: TicketWidth = query.largeur === '80' ? 80 : 58;

  const ticket = await loadSaleTicket(context.store, saleId);
  if (!ticket) notFound();

  const printable = width === 58 ? 48 : 72;

  return (
    <>
      <style>{`@page { size: ${width}mm auto; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <TicketPrintControls autoPrint={query.imprimer === '1'} width={width} saleId={saleId} />
      <div
        className="mx-auto py-[4mm] font-mono text-black print:py-[2mm]"
        style={{ width: `${printable}mm`, fontSize: '2.5mm', lineHeight: 1.35 }}
      >
        {ticketPrintRows(ticket, width).map((row, index) => (
          <div
            key={index}
            className="whitespace-pre"
            style={{
              fontWeight: row.bold ? 700 : 400,
              fontSize: row.big ? '5mm' : undefined,
              minHeight: '1em',
            }}
          >
            {row.text}
          </div>
        ))}
      </div>
    </>
  );
}
