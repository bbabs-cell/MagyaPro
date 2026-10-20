import type { Prisma } from '@prisma/client';

import { generateToken, hashToken } from '@/lib/auth/tokens';

/**
 * Clé du lien de suivi d'une commande.
 *
 * Le lien portait l'identifiant de la commande, un `cuid()` v1 : pas
 * énumérable, mais pas un aléa cryptographique non plus (horodatage et
 * compteur en font partie). Or ce lien montre le code de remise et la position
 * du livreur, et permet d'envoyer une preuve de paiement ou de laisser un
 * avis. Il porte désormais 32 octets tirés de `crypto.randomBytes`, dont seule
 * l'empreinte est conservée.
 *
 * Même modèle que les réservations (`lib/reservations.ts`).
 */
export function createOrderAccess(): { key: string; hash: string } {
  const key = generateToken(32);
  return { key, hash: hashToken(key) };
}

/**
 * Filtre « la commande que ce lien désigne ». Une commande antérieure aux clés
 * (`accessTokenHash` vide) reste joignable par son identifiant : ses liens
 * circulent déjà par WhatsApp et SMS. Une commande récente ne l'est **que**
 * par sa clé.
 */
export function orderAccessWhere(key: string): Prisma.OrderWhereInput {
  return { OR: [{ accessTokenHash: hashToken(key) }, { id: key, accessTokenHash: null }] };
}
