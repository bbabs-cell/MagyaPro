import { describe, expect, it } from 'vitest';

import { hasSavedCustomer } from '@/lib/site/saved-customer';

/**
 * Coordonnées retenues d'un client de restaurant.
 *
 * La lecture et l'écriture touchent au stockage du navigateur et ne sont pas
 * testables ici. La règle qui décide s'il y a « quelqu'un de reconnu », elle,
 * commande l'apparition du bouton « Ce n'est pas vous ? » et le
 * pré-remplissage : elle doit être juste.
 */

describe('Client reconnu', () => {
  it('reconnaît un client dès qu’un nom ou un téléphone est retenu', () => {
    expect(hasSavedCustomer({ name: 'Awa Koné', phone: '', email: '', address: '' })).toBe(true);
    expect(hasSavedCustomer({ name: '', phone: '+225 07 11 11 11', email: '', address: '' })).toBe(true);
  });

  it('ne reconnaît personne sur une fiche vide', () => {
    expect(hasSavedCustomer({ name: '', phone: '', email: '', address: '' })).toBe(false);
  });

  it('ne se laisse pas tromper par des espaces', () => {
    // Sinon le formulaire annoncerait un client reconnu et proposerait de
    // l'oublier, alors qu'il n'y a rien à pré-remplir.
    expect(hasSavedCustomer({ name: '   ', phone: '\t\n ', email: '', address: '' })).toBe(false);
  });

  it('ne reconnaît pas quelqu’un sur la seule adresse', () => {
    // Une adresse sans nom ni téléphone ne permet pas de passer commande :
    // ce n'est pas de quoi accueillir un habitué.
    expect(hasSavedCustomer({ name: '', phone: '', email: '', address: 'Cocody' })).toBe(false);
  });
});
