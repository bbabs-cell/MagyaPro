import type { CSSProperties } from 'react';
import type { ReservationStatus, ReviewStatus, TableStatus } from '@prisma/client';

/**
 * Couleurs d'état des tableaux de bord Restaurant et Boutique — une seule
 * grille de lecture pour tous les écrans. En Boutique, la « braise » est la
 * couleur de marque dorée : `brand` suit le thème.
 *
 * | ton       | sens                                   | exemples                                  |
 * |-----------|----------------------------------------|-------------------------------------------|
 * | `brand`   | à traiter par vous, maintenant         | commande nouvelle, réservation, avis à valider |
 * | `info`    | acceptée, en route                     | commande confirmée, réservation confirmée, table occupée |
 * | `warning` | en cours ou à surveiller               | en préparation, à encaisser, table à nettoyer |
 * | `success` | terminé, acquis                        | commande terminée, payée, avis publié, table libre |
 * | `danger`  | annulé, refusé, en retard              | commande annulée, avis rejeté             |
 * | `neutral` | archivé, sans enjeu                    | remboursée, désactivé                     |
 *
 * La couleur accompagne toujours un libellé : elle ne porte jamais seule
 * l'information. Elle ne sert pas non plus à distinguer des séries dans un
 * graphique.
 */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/**
 * Classes de chaque ton, écrites en entier pour que Tailwind les retrouve.
 *
 * - `rail` : la **couleur CSS** du liseré gauche d'une fiche — son état se
 *   lit d'un coup d'œil en faisant défiler la liste. Une valeur et non une
 *   classe : posée en style, elle l'emporte sur la bordure de la fiche
 *   mobile (`.table-stack tbody tr`), plus spécifique qu'un utilitaire ;
 * - `dot` : la pastille du filtre correspondant ;
 * - `soft` : un bouton qui **mène** à cet état (« Confirmer » est bleu comme
 *   une commande confirmée), ou un badge.
 */
export const TONE_CLASSES: Record<Tone, { rail: string; dot: string; soft: string }> = {
  brand: { rail: 'var(--brand, #ff5e2e)', dot: 'bg-brand', soft: 'bg-brand-soft text-brand-text' },
  info: { rail: 'var(--state-info-rail, #0ea5e9)', dot: 'bg-sky-500', soft: 'bg-state-info-soft text-state-info' },
  warning: { rail: 'var(--state-warn, #b45309)', dot: 'bg-state-warn', soft: 'bg-state-warn-soft text-state-warn' },
  success: { rail: 'var(--state-ok, #047857)', dot: 'bg-state-ok', soft: 'bg-state-ok-soft text-state-ok' },
  danger: { rail: 'var(--state-bad, #b91c1c)', dot: 'bg-state-bad', soft: 'bg-state-bad-soft text-state-bad' },
  neutral: { rail: 'var(--surface-border, #ddd3c1)', dot: 'bg-ink-faint', soft: 'bg-surface-sunken text-ink-muted' },
};

/** Liseré gauche d'une fiche, à la couleur de son état. */
export function railStyle(tone: Tone): CSSProperties {
  return { borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: TONE_CLASSES[tone].rail };
}

/**
 * Bouton d'action secondaire d'une ligne (« Modifier », « Ouvrir ») : teinte
 * neutre, pour laisser la braise au seul bouton principal de l'écran.
 */
export const NEUTRAL_ACTION = 'bg-surface-sunken text-ink';

/** Geste destructeur (« Supprimer », « Annuler ») : rouge discret, toujours en dernier. */
export const DESTRUCTIVE_ACTION = 'text-state-bad hover:bg-state-bad-soft';

/** Une réservation en attente est à traiter, comme une commande nouvelle. */
export const RESERVATION_STATUS_TONES: Record<ReservationStatus, Tone> = {
  PENDING: 'brand',
  CONFIRMED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/** Un avis en attente est à traiter ; publié, il est acquis. */
export const REVIEW_STATUS_TONES: Record<ReviewStatus, Tone> = {
  PENDING: 'brand',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Libre est l'état souhaité ; occupée suit son cours ; à nettoyer demande un geste. */
export const TABLE_STATUS_TONES: Record<TableStatus, Tone> = {
  FREE: 'success',
  OCCUPIED: 'info',
  NEEDS_CLEANING: 'warning',
};
