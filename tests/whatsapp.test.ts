import { describe, expect, it } from 'vitest';

import {
  creditReminderMessage,
  dialCodeFor,
  saleReceiptMessage,
  whatsAppLinkFor,
  whatsAppNumber,
} from '@/lib/whatsapp';

/**
 * Un numéro local envoyé tel quel à `wa.me` ouvrirait la conversation d'un
 * inconnu. Ces tests fixent la règle : indicatif du pays de la boutique, et
 * sans certitude, le choix du contact plutôt qu'une supposition.
 */
describe('Numéros WhatsApp', () => {
  it('reconnaît les pays de la zone, quelle que soit la saisie', () => {
    expect(dialCodeFor('Sénégal')).toBe('221');
    expect(dialCodeFor("Côte d'Ivoire")).toBe('225');
    expect(dialCodeFor('cote divoire')).toBe('225');
    expect(dialCodeFor('Cameroun')).toBe('237');
    expect(dialCodeFor('Guinée-Bissau')).toBe('245');
    expect(dialCodeFor('Guinée')).toBe('224');
    expect(dialCodeFor('France')).toBeNull();
    expect(dialCodeFor(null)).toBeNull();
  });

  it('ajoute l’indicatif à un numéro local', () => {
    expect(whatsAppNumber('77 123 45 67', 'Sénégal')).toBe('221771234567');
  });

  it('garde le zéro de tête ivoirien, qui fait partie du numéro', () => {
    expect(whatsAppNumber('07 08 09 10 11', "Côte d'Ivoire")).toBe('2250708091011');
  });

  it('laisse intact un numéro déjà international', () => {
    expect(whatsAppNumber('+221 77 123 45 67', 'Mali')).toBe('221771234567');
    expect(whatsAppNumber('00225 0708091011', 'Sénégal')).toBe('2250708091011');
    expect(whatsAppNumber('221771234567', 'Mali')).toBe('221771234567');
  });

  it('ne devine pas sans pays connu : le commerçant choisira le contact', () => {
    expect(whatsAppNumber('77 123 45 67', null)).toBeNull();
    expect(whatsAppLinkFor('77 123 45 67', null, 'Bonjour')).toBe('https://wa.me/?text=Bonjour');
  });

  it('adresse le lien au client quand le numéro est sûr', () => {
    expect(whatsAppLinkFor('77 123 45 67', 'Sénégal', 'Bonjour')).toBe(
      'https://wa.me/221771234567?text=Bonjour',
    );
  });
});

describe('Messages', () => {
  it('rédige un reçu lisible, sans lien vers une page réservée à la boutique', () => {
    const message = saleReceiptMessage({
      storeName: 'Marché du Coin',
      saleNumber: 48,
      date: '12/10/2026 14:05',
      lines: [
        { label: 'Riz parfumé', quantity: '2 kg', total: '1 800 F CFA' },
        { label: 'Eau minérale', quantity: '1 carton', total: '5 400 F CFA' },
      ],
      total: '7 200 F CFA',
      customerName: 'Awa Koné',
    });
    expect(message).toContain('Bonjour Awa,');
    expect(message).toContain('Reçu n°48');
    expect(message).toContain('• 1 carton Eau minérale : 5 400 F CFA');
    expect(message).toContain('Total : 7 200 F CFA');
    expect(message).not.toMatch(/https?:\/\//);
  });

  it('rappelle une dette par le prénom, sans ton comminatoire', () => {
    const message = creditReminderMessage({
      storeName: 'Marché du Coin',
      customerName: 'Moussa Diallo',
      balance: '12 000 F CFA',
    });
    expect(message).toContain('Bonjour Moussa,');
    expect(message).toContain('il reste 12 000 F CFA à régler');
  });
});
