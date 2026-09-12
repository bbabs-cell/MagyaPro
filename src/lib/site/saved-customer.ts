'use client';

/**
 * Coordonnées du client, retenues sur son propre appareil.
 *
 * Le panier était mémorisé, le jeton de table aussi — mais pas le nom, le
 * téléphone ni l'adresse. Un habitué qui commande chaque semaine au même
 * restaurant retapait donc tout à chaque fois, au clavier d'un téléphone.
 * C'est le frein le plus coûteux du tunnel : il tombe juste avant le paiement,
 * au moment où l'on abandonne le plus facilement.
 *
 * Trois principes, repris de `cart-context.tsx` :
 *
 * — cloisonné par restaurant. Deux enseignes ne partagent pas les
 *   coordonnées de leurs clients, même dans le navigateur de la même
 *   personne ;
 * — sur l'appareil, jamais envoyé nulle part. Rien de plus n'est transmis au
 *   serveur que ce que le client saisissait déjà lui-même ;
 * — effaçable. Un téléphone se prête ; le client doit pouvoir dire « ce n'est
 *   pas moi » d'un geste.
 */

export type SavedCustomer = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const EMPTY: SavedCustomer = { name: '', phone: '', email: '', address: '' };

function storageKey(restaurantId: string): string {
  return `magyapro:client:${restaurantId}`;
}

export function readSavedCustomer(restaurantId: string): SavedCustomer {
  if (typeof window === 'undefined') return EMPTY;

  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY;

    // Relecture défensive : le contenu vient du navigateur, pas du serveur. Un
    // stockage abîmé — par une version précédente, une extension, une
    // manipulation — ne doit pas empêcher de commander.
    const record = parsed as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 200) : '');

    return {
      name: text(record.name),
      phone: text(record.phone),
      email: text(record.email),
      address: text(record.address),
    };
  } catch {
    return EMPTY;
  }
}

export function saveCustomer(restaurantId: string, customer: SavedCustomer): void {
  if (typeof window === 'undefined') return;

  // Rien à retenir tant qu'on n'a ni nom ni téléphone : inutile d'écrire une
  // fiche vide qui ferait ensuite croire à un client reconnu.
  if (!customer.name.trim() && !customer.phone.trim()) return;

  try {
    window.localStorage.setItem(storageKey(restaurantId), JSON.stringify(customer));
  } catch {
    // Navigation privée, stockage plein ou refusé : la commande passe quand
    // même, elle ne sera simplement pas pré-remplie la prochaine fois.
  }
}

export function forgetCustomer(restaurantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(restaurantId));
  } catch {
    // Sans stockage, il n'y avait rien à oublier.
  }
}

/** Vrai dès qu'on a de quoi pré-remplir utilement le formulaire. */
export function hasSavedCustomer(customer: SavedCustomer): boolean {
  return Boolean(customer.name.trim() || customer.phone.trim());
}
