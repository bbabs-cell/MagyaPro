import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, createTestStore, resetDatabase, type TestStore } from './helpers';
import {
  buildTicket,
  encodeEscPos,
  encodeText,
  leftRight,
  ticketColumns,
  ticketTextLines,
  wrap,
  type TicketData,
} from '@/lib/boutique/ticket';
import { loadSaleTicket } from '@/lib/boutique/ticket-load';
import { createSale } from '@/lib/boutique/sales-service';

const sample: TicketData = buildTicket({
  store: { name: 'Boutique Chez Awa', addressLine: 'Rue 10, Médina', city: 'Dakar', phone: '77 123 45 67' },
  currency: 'XOF',
  paymentLabel: (method) => (method === 'cash' ? 'Espèces' : method),
  sale: {
    number: 42,
    createdAt: '2026-10-12T10:30:00.000Z',
    subtotal: 24500,
    discount: 500,
    taxAmount: 0,
    total: 24000,
    creditAmount: 14000,
    items: [
      { productName: 'Eau minérale 1,5 L', quantity: '6.000000', unitLabel: 'bouteille', unitFactor: '1', unitPrice: 500, total: 3000 },
      { productName: 'Soda 33 cl', quantity: '48', unitLabel: 'carton', unitFactor: '24', unitPrice: 6000, total: 12000 },
      {
        productName: 'Huile végétale de très grande qualité supérieure',
        variantLabel: '5 L',
        quantity: 1,
        unitLabel: null,
        unitPrice: 9500,
        total: 9500,
      },
    ],
    payments: [{ method: 'cash', amount: 10000 }],
    customer: { name: 'Fatou Diop' },
  },
});

describe('Ticket — mise en colonnes', () => {
  it('ne dépasse jamais la largeur du rouleau', () => {
    for (const width of [58, 80] as const) {
      const columns = ticketColumns(width);
      for (const line of ticketTextLines(sample, width)) {
        expect(line.length).toBeLessThanOrEqual(columns);
      }
    }
  });

  it('cale les montants à droite et garde le contenu utile', () => {
    const lines = ticketTextLines(sample, 58);
    const text = lines.join('\n');
    expect(text).toContain('Ticket n°42');
    expect(text).toContain('Client : Fatou Diop');
    expect(text).toContain('  6 bouteilles x 500 F CFA');
    // Quantité stockée en bouteilles, vendue en cartons : « 2 cartons ».
    expect(text).toContain('  2 cartons x 6 000 F CFA');
    expect(text).toContain('Huile végétale de très grande');
    expect(text).toMatch(/Remise\s+-500 F CFA/);
    expect(text).toMatch(/Reste à payer\s+14 000 F CFA/);
    // Aucun espace insécable : il s'imprimerait comme un symbole.
    expect(text).not.toMatch(/[  ]/);
    const total = lines.find((line) => line.startsWith('TOTAL'))!;
    expect(total).toHaveLength(32);
    expect(total.endsWith('24 000 F CFA')).toBe(true);
  });

  it('coupe les mots trop longs et aligne gauche/droite', () => {
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('un deux trois', 8)).toEqual(['un deux', 'trois']);
    expect(leftRight('Article au nom interminable', '1 000', 16)).toBe('Article au 1 000');
  });
});

describe('Ticket — ESC/POS', () => {
  it('encode les accents français en PC850', () => {
    const bytes = encodeText('été à Saint-Louis, ça coûte 5 €', true);
    // é=0x82, à=0x85, ç=0x87, û=0x96 dans la table IBM 850.
    expect(bytes.slice(0, 4)).toEqual([0x82, 0x74, 0x82, 0x20]);
    expect(bytes[4]).toBe(0x85);
    expect(bytes).toContain(0x87);
    expect(bytes).toContain(0x96);
    expect(String.fromCharCode(...bytes.slice(-5))).toBe('5 EUR');
  });

  it('retombe sur des lettres sans accent si demandé', () => {
    const bytes = encodeText('Café crème — « œuf »', false);
    expect(String.fromCharCode(...bytes)).toBe('Cafe creme - ? oeuf ?');
  });

  it('initialise, choisit la page de code, puis avance et coupe', () => {
    const bytes = Array.from(encodeEscPos(sample, { width: 58, accents: true }));
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 2]);
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0]);
    // Sans accents : pas de changement de page de code, et rien au-delà de l'ASCII.
    const ascii = Array.from(encodeEscPos(sample, { width: 80, accents: false }));
    expect(ascii.slice(0, 3)).toEqual([0x1b, 0x40, 0x1b]);
    expect(ascii[3]).not.toBe(0x74);
    expect(ascii.every((byte) => byte < 0x80)).toBe(true);
  });
});

describe('Ticket — réimpression', () => {
  let shop: TestStore;

  beforeAll(async () => {
    await resetDatabase();
    shop = await createTestStore({ variantPrice: 2500 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("relit la vente avec le libellé du moyen de paiement de la boutique", async () => {
    await prisma.storePaymentMethod.create({
      data: { storeId: shop.store.id, method: 'wave', label: 'Wave Business', position: 0 },
    });
    const sale = await createSale({
      storeId: shop.store.id,
      userId: shop.owner.id,
      userEmail: shop.owner.email,
      input: {
        items: [{ productVariantId: shop.variant.id, quantity: 2 }],
        discount: 0,
        payments: [{ method: 'wave', amount: 5000 }],
      },
    });

    const ticket = await loadSaleTicket(shop.store, sale.id);
    expect(ticket).not.toBeNull();
    expect(ticket!.total).toBe(5000);
    expect(ticket!.payments).toEqual([{ label: 'Wave Business', amount: 5000 }]);
    expect(ticket!.lines[0]).toMatchObject({ label: 'Produit test', quantity: '2 pièces', total: 5000 });
  });

  it("ne rend jamais la vente d'une autre boutique", async () => {
    const other = await createTestStore();
    const sale = await createSale({
      storeId: other.store.id,
      userId: other.owner.id,
      userEmail: other.owner.email,
      input: {
        items: [{ productVariantId: other.variant.id, quantity: 1 }],
        discount: 0,
        payments: [{ method: 'cash', amount: 5000 }],
      },
    });

    expect(await loadSaleTicket(shop.store, sale.id)).toBeNull();
  });
});
