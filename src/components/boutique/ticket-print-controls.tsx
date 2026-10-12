'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Barre au-dessus du ticket (masquée à l'impression), et impression
 * automatique quand la page est ouverte depuis la caisse.
 */
export function TicketPrintControls({
  autoPrint,
  width,
  saleId,
}: {
  autoPrint: boolean;
  width: 58 | 80;
  saleId: string;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    // Laisse la police se charger avant d'ouvrir l'impression.
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const other = width === 58 ? 80 : 58;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="h-10 rounded-xl bg-black px-4 font-medium text-white"
      >
        Imprimer le ticket
      </button>
      <Link
        href={`/boutique/ticket/${encodeURIComponent(saleId)}?largeur=${other}`}
        className="h-10 rounded-xl border border-neutral-300 px-4 leading-10 text-neutral-800"
      >
        Format {other} mm
      </Link>
    </div>
  );
}
