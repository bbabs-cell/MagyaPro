import type { Prisma, PrismaClient } from '@prisma/client';

import { ValidationError } from '@/lib/errors';
import { clampAmount, percentOf } from '@/lib/money';

/**
 * Moteur de tarification des commandes.
 *
 * Règle fondatrice : **aucun montant n'est accepté du navigateur**. Le panier
 * transmis ne contient que des identifiants et des quantités ; tous les prix
 * sont relus dans la base, à l'intérieur de la transaction qui crée la
 * commande. Un client qui modifierait le JSON de sa requête pour se donner un
 * plat à 0 obtiendrait exactement le même total qu'un client honnête.
 *
 * Le moteur est une fonction pure de la base de données : il ne dépend ni de
 * la requête HTTP ni de la session, ce qui le rend testable directement.
 */

type DbClient = PrismaClient | Prisma.TransactionClient;

export type PricedOptionSnapshot = {
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type PricedItem = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  options: PricedOptionSnapshot[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type PricedOrder = {
  items: PricedItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  currency: string;
  promotionId: string | null;
  promoCode: string | null;
  deliveryZoneId: string | null;
};

export type CartInput = {
  productId: string;
  variantId?: string | null;
  optionIds?: string[];
  quantity: number;
};

export type PriceOrderInput = {
  restaurantId: string;
  items: CartInput[];
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  deliveryZoneId?: string | null;
  promoCode?: string | null;
};

/**
 * Calcule une commande complète.
 *
 * L'ordre des opérations est significatif : la remise s'applique au
 * sous-total (hors livraison), puis les frais de livraison sont ajoutés. Un
 * code « -20 % » ne doit pas rogner la course du livreur.
 */
export async function priceOrder(
  db: DbClient,
  input: PriceOrderInput,
): Promise<PricedOrder> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { id: true, currency: true, status: true, settings: true },
  });

  if (!restaurant || restaurant.status !== 'ACTIVE') {
    throw new ValidationError("Ce restaurant n'accepte pas de commandes actuellement.");
  }

  const settings = restaurant.settings;
  if (settings && !settings.orderingEnabled) {
    throw new ValidationError(
      'Les commandes en ligne sont temporairement désactivées pour ce restaurant.',
    );
  }

  if (input.fulfillmentType === 'DELIVERY' && settings && !settings.deliveryEnabled) {
    throw new ValidationError("Ce restaurant ne propose pas la livraison.");
  }
  if (input.fulfillmentType === 'PICKUP' && settings && !settings.pickupEnabled) {
    throw new ValidationError("Ce restaurant ne propose pas le retrait sur place.");
  }

  const items = await priceItems(db, input.restaurantId, input.items);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  if (settings && subtotal < settings.minOrderAmount) {
    throw new ValidationError(
      `Le montant minimum de commande n'est pas atteint.`,
    );
  }

  const { discount, promotionId, promoCode } = await computeDiscount(
    db,
    input.restaurantId,
    subtotal,
    input.promoCode,
  );

  const { deliveryFee, deliveryZoneId } = await computeDeliveryFee(
    db,
    input.restaurantId,
    subtotal,
    input.fulfillmentType,
    input.deliveryZoneId,
  );

  // La remise ne peut pas dépasser le sous-total : sinon un code fixe généreux
  // rendrait le total négatif, c'est-à-dire un remboursement.
  const appliedDiscount = clampAmount(discount, subtotal);
  const total = subtotal - appliedDiscount + deliveryFee;

  return {
    items,
    subtotal,
    discount: appliedDiscount,
    deliveryFee,
    total,
    currency: restaurant.currency,
    promotionId,
    promoCode,
    deliveryZoneId,
  };
}

/**
 * Valorise chaque ligne du panier.
 *
 * Le filtre `restaurantId` sur le chargement des produits est un contrôle
 * d'isolation : il empêche de composer un panier avec le plat à 500 F d'un
 * restaurant et de le commander chez un autre.
 */
async function priceItems(
  db: DbClient,
  restaurantId: string,
  cart: CartInput[],
): Promise<PricedItem[]> {
  if (cart.length === 0) {
    throw new ValidationError('Votre panier est vide.');
  }

  const productIds = [...new Set(cart.map((item) => item.productId))];

  const products = await db.product.findMany({
    where: { id: { in: productIds }, restaurantId },
    include: {
      variants: true,
      optionGroups: { include: { options: true } },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  return cart.map((line) => {
    const product = byId.get(line.productId);
    if (!product) {
      throw new ValidationError(
        "Un des articles de votre panier n'est plus disponible. Actualisez la page.",
      );
    }
    if (!product.isAvailable || product.badge === 'SOLD_OUT') {
      throw new ValidationError(`« ${product.name} » n'est plus disponible.`);
    }

    // --- Variante --------------------------------------------------------
    let unitPrice = product.price;
    let variantName: string | null = null;

    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new ValidationError(
          `L'option de taille choisie pour « ${product.name} » n'existe plus.`,
        );
      }
      if (!variant.isAvailable) {
        throw new ValidationError(
          `« ${product.name} — ${variant.name} » n'est plus disponible.`,
        );
      }
      unitPrice = variant.price; // la variante remplace le prix de base
      variantName = variant.name;
    }

    // --- Options ---------------------------------------------------------
    const selectedIds = new Set(line.optionIds ?? []);
    const options: PricedOptionSnapshot[] = [];

    for (const group of product.optionGroups) {
      const chosen = group.options.filter((option) => selectedIds.has(option.id));

      if (chosen.length < group.minSelect) {
        throw new ValidationError(
          `Choisissez au moins ${group.minSelect} option(s) dans « ${group.name} ».`,
        );
      }
      if (chosen.length > group.maxSelect) {
        throw new ValidationError(
          `Vous ne pouvez pas choisir plus de ${group.maxSelect} option(s) dans « ${group.name} ».`,
        );
      }

      for (const option of chosen) {
        if (!option.isAvailable) {
          throw new ValidationError(`L'option « ${option.name} » n'est plus disponible.`);
        }
        unitPrice += option.priceDelta;
        options.push({
          groupName: group.name,
          optionName: option.name,
          priceDelta: option.priceDelta,
        });
        selectedIds.delete(option.id);
      }
    }

    // Un identifiant d'option restant n'appartient pas à ce produit : soit la
    // requête a été forgée, soit le menu a changé pendant la commande.
    if (selectedIds.size > 0) {
      throw new ValidationError(
        `Une option choisie pour « ${product.name} » n'est pas valide.`,
      );
    }

    // Un cumul de suppléments négatifs ne doit pas produire un prix négatif.
    unitPrice = clampAmount(unitPrice);

    return {
      productId: product.id,
      variantId: line.variantId ?? null,
      productName: product.name,
      variantName,
      options,
      unitPrice,
      quantity: line.quantity,
      lineTotal: unitPrice * line.quantity,
    };
  });
}

/** Valide un code promo et calcule la remise. Toutes les règles sont serveur. */
async function computeDiscount(
  db: DbClient,
  restaurantId: string,
  subtotal: number,
  code?: string | null,
): Promise<{ discount: number; promotionId: string | null; promoCode: string | null }> {
  if (!code) return { discount: 0, promotionId: null, promoCode: null };

  const normalized = code.trim().toUpperCase();
  const promotion = await db.promotion.findUnique({
    where: { restaurantId_code: { restaurantId, code: normalized } },
  });

  if (!promotion || !promotion.isActive) {
    throw new ValidationError('Ce code promo est invalide.');
  }

  const now = new Date();
  if (promotion.startsAt && promotion.startsAt > now) {
    throw new ValidationError("Ce code promo n'est pas encore actif.");
  }
  if (promotion.endsAt && promotion.endsAt < now) {
    throw new ValidationError('Ce code promo a expiré.');
  }
  if (
    promotion.maxRedemptions !== null &&
    promotion.usedCount >= promotion.maxRedemptions
  ) {
    throw new ValidationError("Ce code promo a atteint sa limite d'utilisation.");
  }
  if (subtotal < promotion.minOrder) {
    throw new ValidationError(
      'Votre commande n\'atteint pas le montant minimum requis par ce code promo.',
    );
  }

  const discount =
    promotion.type === 'PERCENT'
      ? percentOf(subtotal, promotion.value)
      : promotion.value;

  return {
    discount: clampAmount(discount, subtotal),
    promotionId: promotion.id,
    promoCode: promotion.code,
  };
}

/** Détermine les frais de livraison à partir de la zone choisie. */
async function computeDeliveryFee(
  db: DbClient,
  restaurantId: string,
  subtotal: number,
  fulfillmentType: 'DELIVERY' | 'PICKUP',
  zoneId?: string | null,
): Promise<{ deliveryFee: number; deliveryZoneId: string | null }> {
  if (fulfillmentType === 'PICKUP') {
    return { deliveryFee: 0, deliveryZoneId: null };
  }

  const zones = await db.deliveryZone.count({
    where: { restaurantId, isActive: true },
  });

  // Aucune zone configurée : la livraison est offerte plutôt que bloquée, pour
  // ne pas empêcher de commander chez un restaurant qui n'a pas encore réglé
  // ses tarifs.
  if (zones === 0) return { deliveryFee: 0, deliveryZoneId: null };

  if (!zoneId) {
    throw new ValidationError('Choisissez votre zone de livraison.');
  }

  const zone = await db.deliveryZone.findFirst({
    where: { id: zoneId, restaurantId, isActive: true },
  });
  if (!zone) {
    throw new ValidationError("La zone de livraison choisie n'est pas disponible.");
  }

  if (subtotal < zone.minOrder) {
    throw new ValidationError(
      `Le montant minimum de commande pour la zone « ${zone.name} » n'est pas atteint.`,
    );
  }

  const isFree = zone.freeAbove !== null && subtotal >= zone.freeAbove;
  return {
    deliveryFee: isFree ? 0 : zone.fee,
    deliveryZoneId: zone.id,
  };
}
