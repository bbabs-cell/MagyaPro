import type { MembershipRole } from '@prisma/client';

/**
 * Permissions applicatives.
 *
 * Le contrôle d'accès est piloté par des *permissions*, pas par des rôles :
 * les rôles ne sont qu'un raccourci vers un ensemble de permissions. Ajouter
 * un rôle ou accorder une permission ponctuelle à un employé ne demande donc
 * aucune modification des points de contrôle.
 */
export const PERMISSIONS = [
  'restaurant:view',
  'restaurant:update',
  'restaurant:publish',
  'restaurant:delete',

  'menu:view',
  'menu:manage',

  'orders:view',
  'orders:update_status',
  'orders:cancel',

  'customers:view',

  'delivery:manage',
  'promotions:manage',
  'payments:view',
  'payments:manage',

  'reviews:moderate',
  'reservations:manage',

  'tables:view',
  'tables:manage',

  'deliveries:drive',

  'analytics:view',

  'team:view',
  'team:manage',

  'settings:manage',
  'subscription:view',
  'subscription:manage',
  'domains:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'restaurant:view',
  'menu:view',
  'orders:view',
  'orders:update_status',
  'customers:view',
  'reservations:manage',
  'tables:view',
  'deliveries:drive',
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  'restaurant:update',
  'restaurant:publish',
  'menu:manage',
  'orders:cancel',
  'delivery:manage',
  'promotions:manage',
  'payments:view',
  'reviews:moderate',
  'tables:manage',
  'analytics:view',
  'team:view',
  'settings:manage',
  'subscription:view',
  'domains:manage',
];

/** Le propriétaire dispose de toutes les permissions de son restaurant. */
const OWNER_PERMISSIONS: Permission[] = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
};

export function permissionsForRole(role: MembershipRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Permissions effectives : celles du rôle, plus les permissions accordées
 * individuellement (`RestaurantUser.extraPermissions`).
 */
export function effectivePermissions(
  role: MembershipRole,
  extraPermissions: string[] = [],
): Set<Permission> {
  const set = new Set<Permission>(permissionsForRole(role));
  for (const extra of extraPermissions) {
    if ((PERMISSIONS as readonly string[]).includes(extra)) {
      set.add(extra as Permission);
    }
  }
  return set;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  EMPLOYEE: 'Employé',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'restaurant:view': 'Voir le restaurant',
  'restaurant:update': 'Modifier le restaurant',
  'restaurant:publish': 'Publier le site',
  'restaurant:delete': 'Supprimer le restaurant',
  'menu:view': 'Voir le menu',
  'menu:manage': 'Gérer le menu',
  'orders:view': 'Voir les commandes',
  'orders:update_status': 'Changer le statut des commandes',
  'orders:cancel': 'Annuler des commandes',
  'customers:view': 'Voir les clients',
  'delivery:manage': 'Gérer la livraison',
  'promotions:manage': 'Gérer les promotions',
  'payments:view': 'Voir les paiements',
  'payments:manage': 'Gérer les paiements',
  'reviews:moderate': 'Modérer les avis',
  'reservations:manage': 'Gérer les réservations',
  'tables:view': 'Voir le plan de salle',
  'tables:manage': 'Gérer les tables',
  'deliveries:drive': 'Effectuer des livraisons',
  'analytics:view': 'Voir les statistiques',
  'team:view': "Voir l'équipe",
  'team:manage': "Gérer l'équipe",
  'settings:manage': 'Gérer les réglages',
  'subscription:view': "Voir l'abonnement",
  'subscription:manage': "Gérer l'abonnement",
  'domains:manage': 'Gérer les domaines',
};
