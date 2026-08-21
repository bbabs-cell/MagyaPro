import type { StoreRole } from '@prisma/client';

/**
 * Permissions de MagyaPro Boutique — même principe que `src/lib/rbac.ts`
 * (Restaurant) : le contrôle d'accès est piloté par des *permissions*, les
 * rôles n'en sont qu'un raccourci. Fichier volontairement séparé du RBAC
 * Restaurant : les deux produits n'ont ni les mêmes rôles ni les mêmes
 * permissions, et ne doivent jamais se contaminer l'un l'autre.
 */
export const STORE_PERMISSIONS = [
  'store:view',
  'store:update',
  'store:publish',
  'store:delete',

  'products:view',
  'products:manage',

  'inventory:view',
  'inventory:manage',
  'inventory:transfer',

  'purchases:view',
  'purchases:manage',

  'suppliers:view',
  'suppliers:manage',

  'pos:access',
  'sales:view',
  'sales:refund',

  'cash:manage',

  'customers:view',
  'customers:manage',
  'credits:manage',

  'expenses:manage',
  'finances:view',
  'promotions:manage',
  'invoices:view',
  'reports:view',
  'analytics:view',

  'employees:view',
  'employees:manage',
  'audit:view',

  'settings:manage',
  'subscription:view',
  'subscription:manage',
] as const;

export type StorePermission = (typeof STORE_PERMISSIONS)[number];

const CASHIER_PERMISSIONS: StorePermission[] = [
  'store:view',
  'products:view',
  'pos:access',
  'sales:view',
  'cash:manage',
  'customers:view',
];

const SALESPERSON_PERMISSIONS: StorePermission[] = [
  'store:view',
  'products:view',
  'pos:access',
  'sales:view',
  'customers:view',
  'customers:manage',
];

const STOCK_MANAGER_PERMISSIONS: StorePermission[] = [
  'store:view',
  'products:view',
  'products:manage',
  'inventory:view',
  'inventory:manage',
  'inventory:transfer',
  'purchases:view',
  'purchases:manage',
  'suppliers:view',
  'suppliers:manage',
];

const ACCOUNTANT_PERMISSIONS: StorePermission[] = [
  'store:view',
  'sales:view',
  'finances:view',
  'expenses:manage',
  'credits:manage',
  'invoices:view',
  'reports:view',
  'analytics:view',
];

const MANAGER_PERMISSIONS: StorePermission[] = [
  ...new Set<StorePermission>([
    ...CASHIER_PERMISSIONS,
    ...SALESPERSON_PERMISSIONS,
    ...STOCK_MANAGER_PERMISSIONS,
    ...ACCOUNTANT_PERMISSIONS,
    'sales:refund',
    'promotions:manage',
    'employees:view',
  ]),
];

const ADMIN_PERMISSIONS: StorePermission[] = [
  ...new Set<StorePermission>([
    ...MANAGER_PERMISSIONS,
    'store:update',
    'store:publish',
    'employees:manage',
    'audit:view',
    'settings:manage',
    'subscription:view',
  ]),
];

/** Le propriétaire dispose de toutes les permissions de sa boutique. */
const OWNER_PERMISSIONS: StorePermission[] = [...STORE_PERMISSIONS];

const ROLE_PERMISSIONS: Record<StoreRole, StorePermission[]> = {
  CASHIER: CASHIER_PERMISSIONS,
  SALESPERSON: SALESPERSON_PERMISSIONS,
  STOCK_MANAGER: STOCK_MANAGER_PERMISSIONS,
  ACCOUNTANT: ACCOUNTANT_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
};

export function permissionsForStoreRole(role: StoreRole): StorePermission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Permissions effectives : celles du rôle, plus les permissions accordées
 * individuellement (`StoreUser.extraPermissions`).
 */
export function effectiveStorePermissions(
  role: StoreRole,
  extraPermissions: string[] = [],
): Set<StorePermission> {
  const set = new Set<StorePermission>(permissionsForStoreRole(role));
  for (const extra of extraPermissions) {
    if ((STORE_PERMISSIONS as readonly string[]).includes(extra)) {
      set.add(extra as StorePermission);
    }
  }
  return set;
}

export function isStorePermission(value: string): value is StorePermission {
  return (STORE_PERMISSIONS as readonly string[]).includes(value);
}

export const STORE_ROLE_LABELS: Record<StoreRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CASHIER: 'Caissier',
  SALESPERSON: 'Vendeur',
  STOCK_MANAGER: 'Gestionnaire de stock',
  ACCOUNTANT: 'Comptable',
};

export const STORE_PERMISSION_LABELS: Record<StorePermission, string> = {
  'store:view': 'Voir la boutique',
  'store:update': 'Modifier la boutique',
  'store:publish': 'Publier le site',
  'store:delete': 'Supprimer la boutique',
  'products:view': 'Voir les produits',
  'products:manage': 'Gérer les produits',
  'inventory:view': 'Voir le stock',
  'inventory:manage': 'Gérer le stock',
  'inventory:transfer': 'Transférer du stock',
  'purchases:view': 'Voir les achats',
  'purchases:manage': 'Gérer les achats',
  'suppliers:view': 'Voir les fournisseurs',
  'suppliers:manage': 'Gérer les fournisseurs',
  'pos:access': 'Accéder à la caisse (POS)',
  'sales:view': 'Voir les ventes',
  'sales:refund': 'Effectuer des retours/remboursements',
  'cash:manage': 'Gérer les sessions de caisse',
  'customers:view': 'Voir les clients',
  'customers:manage': 'Gérer les clients',
  'credits:manage': 'Gérer les crédits clients',
  'expenses:manage': 'Gérer les dépenses',
  'finances:view': 'Voir les finances',
  'promotions:manage': 'Gérer les promotions',
  'invoices:view': 'Voir les factures',
  'reports:view': 'Voir les rapports',
  'analytics:view': 'Voir les statistiques',
  'employees:view': "Voir l'équipe",
  'employees:manage': "Gérer l'équipe",
  'audit:view': 'Voir le journal',
  'settings:manage': 'Gérer les réglages',
  'subscription:view': "Voir l'abonnement",
  'subscription:manage': "Gérer l'abonnement",
};
