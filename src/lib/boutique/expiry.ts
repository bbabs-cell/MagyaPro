/**
 * État de péremption d'un produit — logique pure, sans base de données.
 *
 * Importable depuis un composant client comme depuis le serveur : la lecture
 * des lots (`StockBatch`) vit à part, dans `expiry-load.ts`.
 *
 * Un seul principe : c'est le lot le plus proche de sa date qui donne l'état
 * du produit. Un carton périmé au fond du rayon rend le produit « périmé »
 * même si le reste du stock est neuf — c'est celui-là qu'il faut sortir.
 *
 * Quatre états plutôt que deux : « périmé » et « bientôt » ne demandent pas
 * la même chose au commerçant. L'un se retire du rayon, l'autre se met en
 * avant ou se solde pendant qu'il en est encore temps.
 */

/** Alerte dès qu'un lot arrive dans cette fenêtre. */
export const EXPIRY_SOON_DAYS = 30;
/** En dessous, il n'est plus temps d'écouler : il faut agir aujourd'hui. */
export const EXPIRY_CRITICAL_DAYS = 7;

export type ExpiryState = 'expired' | 'critical' | 'soon' | 'ok';

const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_LABELS: Record<Exclude<ExpiryState, 'ok'>, string> = {
  expired: 'Périmé',
  critical: 'Périme bientôt',
  soon: 'À écouler',
};

/**
 * Icône associée à chaque état. La couleur seule ne suffit pas : elle exclut
 * les personnes qui la distinguent mal et disparaît à l'impression.
 */
export const EXPIRY_ICONS: Record<Exclude<ExpiryState, 'ok'>, string> = {
  expired: '✕',
  critical: '‼',
  soon: '!',
};

/** Couleur du rail latéral, en écho à `STOCK_RAIL` pour le stock. */
export const EXPIRY_RAIL: Record<Exclude<ExpiryState, 'ok'>, string> = {
  expired: 'var(--state-bad, #b91c1c)',
  critical: 'var(--state-bad, #b91c1c)',
  soon: 'var(--state-warn, #b45309)',
};

/**
 * État d'une date de péremption à un instant donné.
 *
 * `reference` est injectable pour rendre la fonction testable et pour que le
 * serveur et le navigateur puissent partir du même instant — sinon deux
 * rendus successifs peuvent diverger d'une seconde et déclencher un
 * avertissement d'hydratation React.
 */
export function expiryState(expiryDate: Date | string | null, reference: number): ExpiryState {
  if (!expiryDate) return 'ok';
  const time = expiryDate instanceof Date ? expiryDate.getTime() : new Date(expiryDate).getTime();
  if (Number.isNaN(time)) return 'ok';

  if (time <= reference) return 'expired';
  const days = (time - reference) / DAY_MS;
  if (days <= EXPIRY_CRITICAL_DAYS) return 'critical';
  if (days <= EXPIRY_SOON_DAYS) return 'soon';
  return 'ok';
}

/**
 * Phrase courte affichée à côté du produit : « périmé depuis 3 j »,
 * « périme dans 5 j ». Plus parlant qu'une date brute quand on balaie une
 * liste de cent références.
 */
export function expiryLabel(expiryDate: Date | string | null, reference: number): string | null {
  const state = expiryState(expiryDate, reference);
  if (state === 'ok' || !expiryDate) return null;

  const time = expiryDate instanceof Date ? expiryDate.getTime() : new Date(expiryDate).getTime();
  const days = Math.abs(Math.round((time - reference) / DAY_MS));

  if (state === 'expired') {
    return days === 0 ? 'Périmé aujourd’hui' : `Périmé depuis ${days} j`;
  }
  return days === 0 ? 'Périme aujourd’hui' : `Périme dans ${days} j`;
}
