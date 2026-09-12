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
  'loyalty:manage',

  'tables:view',
  'tables:manage',

  'deliveries:drive',

  'analytics:view',
  'finances:manage',
  'audit:view',
  /// Purge du journal — distincte de `audit:view` : un rôle qui ne fait que
  /// consulter le journal ne doit pas pouvoir en effacer irréversiblement
  /// l'historique.
  'audit:manage',

  'team:view',
  'team:manage',

  'settings:manage',
  'subscription:view',
  'subscription:manage',
  'domains:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/// Un livreur n'a besoin que d'une seule chose : voir et prendre en charge
/// des livraisons. Pas même `orders:view` — il ne consulte jamais le détail
/// d'une commande, seulement la fiche de livraison de `/dashboard/livraisons`.
const COURIER_PERMISSIONS: Permission[] = ['deliveries:drive'];

/**
 * Une cuisine a besoin de savoir quoi préparer, et rien d'autre.
 *
 * `orders:update_status` seul : il ouvre l'écran de préparation et autorise
 * les deux gestes du poste — démarrer un plat, le marquer prêt. Pas
 * `orders:view`, qui donnerait la liste complète des commandes avec les
 * coordonnées et les montants ; pas `orders:cancel`, qui n'est pas une
 * décision de cuisine.
 *
 * Ce rôle comble un manque qui coûtait cher. Faute de mieux, un cuisinier
 * était déclaré « Employé » — et recevait alors, dans le même geste, le
 * fichier clients complet, les réservations, le plan de salle et les
 * livraisons. Sept accès pour un poste qui en demande un.
 */
const KITCHEN_PERMISSIONS: Permission[] = ['orders:update_status'];

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
  'loyalty:manage',
  'tables:manage',
  'analytics:view',
  'finances:manage',
  'audit:view',
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
  KITCHEN: KITCHEN_PERMISSIONS,
  COURIER: COURIER_PERMISSIONS,
};

/**
 * Rôles qu'un responsable peut attribuer depuis l'écran Équipe.
 *
 * Tous sauf `OWNER` : la propriété d'un restaurant ne se donne pas depuis une
 * liste déroulante.
 *
 * Cette liste était recopiée à quatre endroits — le sélecteur, la page Équipe,
 * et les deux schémas de validation de l'invitation et de la modification.
 * Quatre copies pour une même vérité, dont deux gardent la porte d'entrée :
 * ajouter un rôle au sélecteur sans l'ajouter au schéma donne un choix que le
 * serveur refuse, et l'inverse donne un rôle que personne ne peut attribuer.
 */
export const ASSIGNABLE_ROLES = ['ADMIN', 'EMPLOYEE', 'KITCHEN', 'COURIER'] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

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
  KITCHEN: 'Cuisine',
  COURIER: 'Livreur',
};

/**
 * Ce que chaque rôle permet, en une phrase, pour l'écran d'invitation.
 *
 * Un propriétaire choisit un rôle dans une liste déroulante ; « Employé » ne
 * dit pas qu'il ouvre le fichier clients, et c'est précisément comme cela
 * qu'un cuisinier se retrouvait avec accès à tout.
 */
export const ROLE_DESCRIPTIONS: Record<MembershipRole, string> = {
  OWNER: 'Tout, y compris la facturation et la suppression du restaurant.',
  ADMIN: 'Tout le quotidien : carte, commandes, équipe, chiffres. Pas la facturation.',
  EMPLOYEE:
    'Salle et service : commandes, réservations, tables, fichier clients, livraisons.',
  KITCHEN: 'Uniquement l’écran de préparation. Ni clients, ni chiffres, ni réglages.',
  COURIER: 'Uniquement ses livraisons : prendre une course, encaisser, confirmer.',
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
  'loyalty:manage': 'Gérer la fidélité',
  'tables:view': 'Voir le plan de salle',
  'tables:manage': 'Gérer les tables',
  'deliveries:drive': 'Effectuer des livraisons',
  'analytics:view': 'Voir les statistiques',
  'finances:manage': 'Gérer les finances',
  'audit:view': 'Voir le journal',
  'audit:manage': 'Purger le journal',
  'team:view': "Voir l'équipe",
  'team:manage': "Gérer l'équipe",
  'settings:manage': 'Gérer les réglages',
  'subscription:view': "Voir l'abonnement",
  'subscription:manage': "Gérer l'abonnement",
  'domains:manage': 'Gérer les domaines',
};
