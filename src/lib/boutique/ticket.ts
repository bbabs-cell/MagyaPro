import { formatMoney } from '@/lib/money';
import { pluralizeUnitLabel } from '@/lib/boutique/units';

/**
 * Ticket de caisse pour imprimante thermique (58 ou 80 mm).
 *
 * Fichier sans dépendance serveur : le même ticket se construit à la caisse,
 * à partir de la vente que le serveur vient de renvoyer (impression immédiate,
 * sans aller-retour), et côté serveur pour une réimpression depuis l'historique.
 *
 * Deux sorties pour un même contenu :
 * - `ticketTextLines` : le ticket mis en colonnes, en texte brut. Sert à la
 *   page imprimée par le navigateur et aux tests ;
 * - `encodeEscPos` : les octets ESC/POS envoyés directement à une imprimante
 *   Bluetooth. C'est le langage que comprennent la quasi-totalité des
 *   imprimantes de ticket vendues en Afrique de l'Ouest (Xprinter, Goojprt,
 *   Sunmi, Epson…).
 */

export type TicketData = {
  store: {
    name: string;
    addressLine?: string | null;
    city?: string | null;
    phone?: string | null;
    legalId?: string | null;
  };
  number: number;
  /** Date ISO. */
  date: string;
  customerName?: string | null;
  lines: Array<{ label: string; detail?: string | null; quantity: string; unitPrice: number; total: number }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  payments: Array<{ label: string; amount: number }>;
  /** Montant laissé à crédit. */
  due: number;
  currency: string;
  footer?: string | null;
};

/** Vente telle que la renvoient l'API et Prisma (quantités Decimal sérialisées en texte). */
export type TicketSale = {
  number: number;
  createdAt: string | Date;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  creditAmount: number;
  items: Array<{
    productName: string;
    variantLabel?: string | null;
    /** En unité de base, comme en base de données. */
    quantity: number | string | { toString(): string };
    unitLabel?: string | null;
    /** Unités de base contenues dans l'unité vendue (24 pour un carton de 24). */
    unitFactor?: number | string | { toString(): string } | null;
    unitPrice: number;
    total: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
  customer?: { name: string } | null;
};

export type TicketWidth = 58 | 80;

/** Caractères par ligne en police normale. */
export function ticketColumns(width: TicketWidth): number {
  return width === 58 ? 32 : 48;
}

function formatQuantity(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/[  ]/g, ' ');
}

export function buildTicket(params: {
  store: TicketData['store'];
  sale: TicketSale;
  currency: string;
  paymentLabel: (method: string) => string;
  footer?: string | null;
}): TicketData {
  const { sale } = params;
  return {
    store: params.store,
    number: sale.number,
    date: typeof sale.createdAt === 'string' ? sale.createdAt : sale.createdAt.toISOString(),
    customerName: sale.customer?.name ?? null,
    lines: sale.items.map((item) => {
      // 24 bouteilles vendues en un carton s'impriment « 1 carton ».
      const factor = item.unitFactor == null ? 1 : Number(String(item.unitFactor));
      const base = Number(String(item.quantity));
      const quantity = factor > 0 ? base / factor : base;
      return {
        label: item.productName,
        detail: item.variantLabel ?? null,
        quantity: [formatQuantity(quantity), item.unitLabel ? pluralizeUnitLabel(item.unitLabel, quantity) : null]
          .filter(Boolean)
          .join(' '),
        unitPrice: item.unitPrice,
        total: item.total,
      };
    }),
    subtotal: sale.subtotal,
    discount: sale.discount,
    taxAmount: sale.taxAmount,
    total: sale.total,
    payments: sale.payments.map((payment) => ({
      label: params.paymentLabel(payment.method),
      amount: payment.amount,
    })),
    due: sale.creditAmount,
    currency: params.currency,
    footer: params.footer ?? null,
  };
}

// --- Mise en colonnes ------------------------------------------------------

/** Les espaces insécables du format monétaire n'existent pas sur une imprimante. */
function money(amount: number, currency: string): string {
  return formatMoney(amount, currency).replace(/[  ]/g, ' ');
}

/** Coupe un texte en lignes de `width` caractères, aux espaces si possible. */
export function wrap(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    let rest = word;
    while (rest.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= width) current += ` ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/** Texte à gauche, montant calé à droite ; le texte est coupé s'il déborde. */
export function leftRight(left: string, right: string, width: number): string {
  const room = width - right.length - 1;
  if (room < 1) return right.slice(0, width);
  const head = left.length > room ? left.slice(0, room) : left;
  return head + ' '.repeat(width - head.length - right.length) + right;
}

function center(text: string, width: number): string {
  const trimmed = text.slice(0, width);
  return ' '.repeat(Math.floor((width - trimmed.length) / 2)) + trimmed;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date
    .toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');
}

/** Un élément du ticket, avec sa mise en forme. */
type Row = { text: string; bold?: boolean; big?: boolean; align?: 'left' | 'center' };

function ticketRows(ticket: TicketData, width: number): Row[] {
  const rows: Row[] = [];
  const rule = '-'.repeat(width);
  const c = ticket.currency;

  // Le nom en double largeur tient sur moitié moins de caractères.
  for (const line of wrap(ticket.store.name, Math.floor(width / 2))) {
    rows.push({ text: line, bold: true, big: true, align: 'center' });
  }
  const address = [ticket.store.addressLine, ticket.store.city].filter(Boolean).join(', ');
  for (const line of address ? wrap(address, width) : []) rows.push({ text: line, align: 'center' });
  if (ticket.store.phone) rows.push({ text: `Tél. ${ticket.store.phone}`, align: 'center' });
  if (ticket.store.legalId) rows.push({ text: ticket.store.legalId, align: 'center' });

  rows.push({ text: rule });
  rows.push({ text: leftRight(`Ticket n°${ticket.number}`, formatDate(ticket.date), width) });
  if (ticket.customerName) rows.push({ text: `Client : ${ticket.customerName}`.slice(0, width) });
  rows.push({ text: rule });

  for (const line of ticket.lines) {
    const label = line.detail ? `${line.label} (${line.detail})` : line.label;
    for (const part of wrap(label, width)) rows.push({ text: part });
    const detail = `  ${line.quantity} x ${money(line.unitPrice, c)}`;
    const total = money(line.total, c);
    if (detail.length + 1 + total.length <= width) {
      rows.push({ text: leftRight(detail, total, width) });
    } else {
      // Trop long pour une ligne de 58 mm : le détail, puis le montant dessous.
      for (const part of wrap(detail, width)) rows.push({ text: `  ${part}`.slice(0, width) });
      rows.push({ text: total.padStart(width) });
    }
  }

  rows.push({ text: rule });
  if (ticket.discount > 0 || ticket.taxAmount > 0) {
    rows.push({ text: leftRight('Sous-total', money(ticket.subtotal, c), width) });
    if (ticket.discount > 0) rows.push({ text: leftRight('Remise', `-${money(ticket.discount, c)}`, width) });
    if (ticket.taxAmount > 0) rows.push({ text: leftRight('TVA', money(ticket.taxAmount, c), width) });
  }
  // Le total en double hauteur seulement : la double largeur couperait les
  // grands montants sur un ticket de 58 mm.
  rows.push({ text: leftRight('TOTAL', money(ticket.total, c), width), bold: true });

  for (const payment of ticket.payments) {
    rows.push({ text: leftRight(payment.label, money(payment.amount, c), width) });
  }
  if (ticket.due > 0) {
    rows.push({ text: leftRight('Reste à payer', money(ticket.due, c), width), bold: true });
  }

  rows.push({ text: '' });
  for (const line of wrap(ticket.footer?.trim() || 'Merci de votre visite !', width)) {
    rows.push({ text: line, align: 'center' });
  }
  return rows;
}

/**
 * Le ticket ligne par ligne, déjà mis en colonnes (centrage compris), avec sa
 * mise en forme — pour la page imprimée par le navigateur.
 */
export function ticketPrintRows(
  ticket: TicketData,
  width: TicketWidth,
): Array<{ text: string; bold: boolean; big: boolean }> {
  const columns = ticketColumns(width);
  return ticketRows(ticket, columns).map((row) => ({
    text: row.align === 'center' ? center(row.text, row.big ? Math.floor(columns / 2) : columns) : row.text,
    bold: Boolean(row.bold),
    big: Boolean(row.big),
  }));
}

/** Le ticket en texte brut, tel qu'il sortira de l'imprimante. */
export function ticketTextLines(ticket: TicketData, width: TicketWidth): string[] {
  return ticketPrintRows(ticket, width).map((row) => row.text);
}

// --- ESC/POS ---------------------------------------------------------------

/**
 * Page de code PC850 (Europe de l'Ouest) : la seule que les imprimantes
 * d'entrée de gamme comprennent presque toutes et qui contienne les accents
 * français. Une imprimante qui l'ignore imprime des symboles à la place des
 * accents — d'où le réglage « sans accents ».
 */
const CP850: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a,
  ï: 0x8b, î: 0x8c, É: 0x90, ô: 0x93, ö: 0x94, û: 0x96, ù: 0x97, '×': 0x9e, '«': 0xae, '»': 0xaf,
  Â: 0xb6, À: 0xb7, Ê: 0xd2, Ë: 0xd3, È: 0xd4, Î: 0xd7, Ï: 0xd8, Ô: 0xe2, Û: 0xea, Ù: 0xeb, '°': 0xf8,
};

const REPLACEMENTS: Record<string, string> = {
  ' ': ' ', ' ': ' ', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-',
  '…': '...', œ: 'oe', Œ: 'OE', '€': 'EUR', '₦': 'N', '₵': 'C',
};

/** Convertit un texte en octets imprimables (PC850, ou ASCII pur). */
export function encodeText(text: string, accents: boolean): number[] {
  const bytes: number[] = [];
  for (const char of text.normalize('NFC')) {
    const replaced = REPLACEMENTS[char];
    if (replaced !== undefined) {
      for (const r of replaced) bytes.push(r.charCodeAt(0));
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) {
      bytes.push(code);
      continue;
    }
    if (accents && CP850[char] !== undefined) {
      bytes.push(CP850[char]!);
      continue;
    }
    // Lettre accentuée hors table, ou mode sans accents : la lettre de base.
    const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const baseCode = base.charCodeAt(0);
    bytes.push(base.length === 1 && baseCode >= 0x20 && baseCode < 0x7f ? baseCode : 0x3f);
  }
  return bytes;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function encodeEscPos(
  ticket: TicketData,
  options: { width: TicketWidth; accents: boolean },
): Uint8Array {
  const columns = ticketColumns(options.width);
  const out: number[] = [ESC, 0x40]; // initialisation
  if (options.accents) out.push(ESC, 0x74, 2); // page de code PC850

  for (const row of ticketRows(ticket, columns)) {
    out.push(ESC, 0x61, row.align === 'center' ? 1 : 0);
    out.push(ESC, 0x45, row.bold ? 1 : 0);
    // Double largeur et hauteur pour le nom, double hauteur pour le reste en gras.
    out.push(GS, 0x21, row.big ? 0x11 : row.bold ? 0x01 : 0x00);
    out.push(...encodeText(row.text, options.accents), LF);
  }

  out.push(ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x61, 0);
  // Avance pour que le ticket dépasse la lame, puis coupe partielle — sans
  // effet sur les imprimantes sans massicot.
  out.push(ESC, 0x64, 4, GS, 0x56, 0x42, 0);
  return Uint8Array.from(out);
}
