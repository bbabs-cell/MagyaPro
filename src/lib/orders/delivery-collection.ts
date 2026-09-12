/**
 * Encaissement à la livraison — ce que le livreur a réellement reçu du client.
 *
 * ## Deux remises d'argent, pas une
 *
 * Une commande payée en espèces à la livraison passe par **deux** mains avant
 * d'arriver au restaurant :
 *
 * 1. le client donne l'argent au livreur, sur le pas de la porte ;
 * 2. le livreur rapporte l'argent au restaurant, en fin de tournée.
 *
 * Le produit ne connaissait que la seconde. Le livreur confirmait la remise du
 * plat avec le code du client, et c'était tout : rien n'enregistrait s'il
 * avait été payé, combien, ni par quel moyen. Entre la porte du client et la
 * caisse du restaurant, l'argent n'existait nulle part.
 *
 * Ce module porte la première remise. La seconde reste ce qu'elle était —
 * `confirmDeliveryPayment`, déclenchée par le restaurant.
 *
 * ## Pourquoi l'encaissement du livreur ne marque pas la commande « payée »
 *
 * C'est la décision structurante de ce module, et elle est délibérée.
 *
 * `PAID` signifie aujourd'hui, partout dans le produit, « le restaurant a
 * l'argent » : les recettes, le compte de résultat et la clôture de caisse en
 * dépendent. Marquer `PAID` dès que le livreur déclare avoir été payé ferait
 * compter au restaurant un argent qui est encore dans la poche de quelqu'un
 * d'autre — et qui peut ne jamais arriver.
 *
 * La déclaration du livreur est donc enregistrée en `PROCESSING` : encaissée,
 * en route. Elle devient `PAID` quand le restaurant constate avoir reçu les
 * espèces, comme avant.
 *
 * ## Le livreur ne fixe pas le montant
 *
 * Le montant attendu vient de la commande, jamais de l'appareil du livreur.
 * « Payé en entier » vaut exactement le total, quoi que le téléphone envoie ;
 * un paiement partiel est borné entre 1 et le total moins un. Un livreur ne
 * peut donc ni minorer une commande, ni déclarer avoir reçu plus que dû.
 */

/** Ce que le livreur déclare avoir obtenu du client. */
export type CollectionOutcome = 'full' | 'partial' | 'none';

/**
 * Moyens d'encaissement possibles sur le pas de la porte.
 *
 * Les identifiants sont ceux du registre de paiement : la ligne créée ici
 * rejoint le même journal que les paiements en ligne, plutôt que d'ouvrir une
 * comptabilité parallèle.
 */
export const COLLECTION_METHODS = [
  { id: 'cash_on_delivery', label: 'Espèces' },
  { id: 'wave_manual', label: 'Wave' },
  { id: 'orange_money_manual', label: 'Orange Money' },
] as const;

export type CollectionMethod = (typeof COLLECTION_METHODS)[number]['id'];

export function isCollectionMethod(value: string): value is CollectionMethod {
  return COLLECTION_METHODS.some((method) => method.id === value);
}

export function collectionMethodLabel(id: string): string {
  return COLLECTION_METHODS.find((method) => method.id === id)?.label ?? id;
}

export type Collection = {
  /** Montant réellement reçu, en unité mineure. */
  collected: number;
  /** Ce qui manque par rapport au total dû. Zéro si le compte y est. */
  shortfall: number;
  /** Vrai si le client a réglé la totalité. */
  fullyPaid: boolean;
};

/** Levée quand la déclaration du livreur est incohérente avec la commande. */
export class InvalidCollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCollectionError';
  }
}

/**
 * Traduit la déclaration du livreur en montant encaissé, en se fiant au total
 * de la commande et jamais au chiffre envoyé par son téléphone.
 *
 * @param expected total dû, en unité mineure, lu sur la commande.
 * @param amount   montant saisi par le livreur — utilisé pour un paiement
 *                 partiel seulement.
 */
export function resolveCollection(
  expected: number,
  outcome: CollectionOutcome,
  amount?: number,
): Collection {
  if (!Number.isInteger(expected) || expected < 0) {
    throw new InvalidCollectionError('Montant de la commande invalide.');
  }

  if (outcome === 'none') {
    return { collected: 0, shortfall: expected, fullyPaid: expected === 0 };
  }

  if (outcome === 'full') {
    // Le total de la commande fait foi. Un téléphone qui enverrait un autre
    // chiffre avec « payé en entier » est simplement ignoré.
    return { collected: expected, shortfall: 0, fullyPaid: true };
  }

  if (!Number.isInteger(amount) || amount === undefined) {
    throw new InvalidCollectionError('Indiquez le montant reçu.');
  }
  if (amount <= 0) {
    throw new InvalidCollectionError(
      'Un paiement partiel doit être supérieur à zéro. Choisissez « Non payé » si le client n\'a rien donné.',
    );
  }
  if (amount >= expected) {
    throw new InvalidCollectionError(
      'Un paiement partiel doit être inférieur au total. Choisissez « Payé en entier » si le compte y est.',
    );
  }

  return { collected: amount, shortfall: expected - amount, fullyPaid: false };
}

/**
 * Ce que le restaurant lit sur une commande livrée, côté argent.
 *
 * Le §17 demande deux issues distinctes — « Livrée et payée » et « Livrée —
 * paiement en attente ». Il en existe en réalité une troisième, qui est la
 * situation courante d'une commande réglée en espèces : le client a payé, le
 * livreur a l'argent, le restaurant ne l'a pas encore. La nommer « en cours »,
 * comme le fait le libellé générique des paiements, ne dit rien d'utile à un
 * restaurateur qui cherche à savoir de qui réclamer sa recette.
 */
export function deliveryPaymentLabel(paymentStatus: string): string {
  switch (paymentStatus) {
    case 'PAID':
      return 'Payée';
    case 'PROCESSING':
      return 'Encaissée par le livreur';
    case 'PENDING':
      return 'Non payée';
    case 'FAILED':
      return 'Paiement refusé';
    case 'REFUNDED':
      return 'Remboursée';
    case 'CANCELLED':
      return 'Paiement annulé';
    default:
      return paymentStatus;
  }
}
