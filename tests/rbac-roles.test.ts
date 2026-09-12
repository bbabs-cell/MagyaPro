import { describe, expect, it } from 'vitest';

import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  effectivePermissions,
  permissionsForRole,
} from '@/lib/rbac';

/**
 * Cloisonnement des rôles restreints.
 *
 * Le défaut relevé à l'audit : il n'existait aucun rôle convenant à un
 * cuisinier. Pour lui ouvrir l'écran de préparation, il fallait le déclarer
 * « Employé » — et lui donner du même geste le fichier clients complet, les
 * réservations, le plan de salle et les livraisons.
 *
 * Ces tests décrivent ce qu'un poste restreint doit voir, et surtout ce qu'il
 * ne doit pas voir. Ils échoueront si quelqu'un élargit un de ces rôles sans
 * y penser — ce qui est précisément la manière dont ce genre de défaut
 * réapparaît.
 */

describe('Rôle Cuisine', () => {
  const kitchen = permissionsForRole('KITCHEN');

  it('ouvre l’écran de préparation, et rien de plus', () => {
    expect(kitchen).toEqual(['orders:update_status']);
  });

  it('ne donne accès ni aux clients, ni aux chiffres, ni aux réglages', () => {
    // La liste nommée plutôt qu'un simple `length === 1` : elle dit ce qui
    // était accessible avant, et ce qui ne doit jamais le redevenir.
    const forbidden = [
      'customers:view',
      'reservations:manage',
      'tables:view',
      'deliveries:drive',
      'orders:view',
      'orders:cancel',
      'analytics:view',
      'finances:manage',
      'settings:manage',
      'team:view',
      'menu:manage',
    ] as const;

    for (const permission of forbidden) {
      expect(kitchen, `Cuisine ne doit pas avoir ${permission}`).not.toContain(permission);
    }
  });
});

describe('Rôle Livreur', () => {
  it('reste limité à ses livraisons', () => {
    expect(permissionsForRole('COURIER')).toEqual(['deliveries:drive']);
  });
});

describe('Attribution des rôles', () => {
  it('n’offre jamais la propriété du restaurant dans une liste déroulante', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('OWNER');
  });

  it('couvre tous les rôles attribuables en libellé et en description', () => {
    // Un rôle sans description apparaîtrait comme une case vide sous son nom,
    // au moment précis où quelqu'un décide de ce qu'un employé pourra voir.
    for (const role of ASSIGNABLE_ROLES) {
      expect(ROLE_LABELS[role], `libellé manquant pour ${role}`).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role], `description manquante pour ${role}`).toBeTruthy();
    }
  });
});

describe('Permissions supplémentaires', () => {
  it('s’ajoutent au rôle sans le remplacer', () => {
    const granted = effectivePermissions('KITCHEN', ['orders:view']);
    expect(granted.has('orders:update_status')).toBe(true);
    expect(granted.has('orders:view')).toBe(true);
  });

  it('ignorent une permission qui n’existe pas', () => {
    // Une valeur inventée envoyée par un client ne doit rien accorder.
    const granted = effectivePermissions('KITCHEN', ['tout:voir', '']);
    expect(granted.size).toBe(1);
    expect([...granted]).toEqual(['orders:update_status']);
  });

  it('n’accordent que des permissions du catalogue', () => {
    const granted = effectivePermissions('OWNER');
    for (const permission of granted) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});
