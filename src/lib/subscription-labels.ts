import type { SubscriptionStatus } from '@prisma/client';

/**
 * Statuts d'abonnement — libellés et tons, source unique.
 *
 * La table existait à six endroits : la vue d'ensemble Super Admin, les deux
 * écrans d'abonnements Super Admin, le formulaire de modification, et les deux
 * écrans d'abonnement côté commerçant. Même problème que les statuts de vente
 * avant `boutique/labels.ts` : les copies étaient cohérentes, ce qui est
 * précisément ce qui les rendait dangereuses.
 *
 * Deux jeux de libellés, volontairement : ils ne s'adressent pas aux mêmes
 * personnes. Le Super Admin lit un état de fait sur la ligne d'un client
 * (« En retard »), le commerçant lit un message qui le concerne
 * (« Paiement en retard »). C'est une distinction délibérée, pas une dérive —
 * elle vit donc ici, explicitement, plutôt que dans deux fichiers qui
 * s'ignorent.
 *
 * Module pur, sans accès à la base : importable par un composant client comme
 * par du code serveur.
 */

/** Ton visuel d'un badge — miroir de `BadgeTone`, sans importer l'interface. */
export type StateTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/** Vue plateforme : l'état du client, constaté. */
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'En essai',
  ACTIVE: 'Actif',
  PAST_DUE: 'En retard',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
};

/** Vue commerçant : ce que l'abonné doit comprendre de sa propre situation. */
export const SUBSCRIPTION_STATUS_MERCHANT_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "Période d'essai",
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
};

/**
 * Un essai n'est pas un abonnement payant, et un résilié n'est pas un expiré :
 * le premier est parti, le second a simplement laissé filer l'échéance et se
 * rattrape d'un paiement. Les peindre pareil effaçait cette différence, la
 * seule qui décide s'il faut relancer.
 */
export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, StateTone> = {
  TRIALING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'danger',
};

/** Ordre d'affichage : du plus engageant au plus perdu. */
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
];

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return Object.prototype.hasOwnProperty.call(SUBSCRIPTION_STATUS_LABELS, value);
}

/**
 * Variante tolérante, pour les écrans où le statut arrive typé `string`
 * (agrégations, projections). Un code inconnu est rendu tel quel plutôt que
 * de laisser une case vide — c'était le défaut des deux tableaux Super Admin,
 * qui affichaient `PAST_DUE` brut faute de passer par une table de libellés.
 */
export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status as SubscriptionStatus] ?? status;
}

/** Idem, dans la formulation adressée à l'abonné lui-même. */
export function subscriptionStatusMerchantLabel(status: string): string {
  return SUBSCRIPTION_STATUS_MERCHANT_LABELS[status as SubscriptionStatus] ?? status;
}

export function subscriptionStatusTone(status: string): StateTone {
  return SUBSCRIPTION_STATUS_TONES[status as SubscriptionStatus] ?? 'neutral';
}
