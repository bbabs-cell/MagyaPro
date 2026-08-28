import { prisma } from '@/lib/db';
import type { Prisma, StockMovementType } from '@prisma/client';

import { toQty } from '@/lib/boutique/quantity';
import { UNIT_LABELS } from '@/lib/boutique/units';
import { parseVariantAxes, variantLabel } from '@/lib/boutique/variants';

/**
 * Lecture de l'historique des mouvements de stock.
 *
 * `InventoryMovement` est la source de vérité du stock — la table
 * `Inventory` n'en est qu'une somme dénormalisée. Chaque écriture y laisse
 * déjà une trace complète (quantité avant, quantité après, auteur, motif,
 * référence de l'opération) ; il ne manquait qu'un écran pour la lire.
 *
 * Aucun calcul ici : on affiche ce qui a été écrit au moment de l'opération,
 * jamais une reconstitution. Un stock qui bouge sans explication consultable
 * est un inventaire qu'on ne peut pas défendre devant un employé.
 */

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'Réception achat',
  SALE: 'Vente',
  RETURN: 'Retour client',
  ADJUSTMENT: 'Ajustement',
  TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant',
  INITIAL: 'Stock initial',
};

export const MOVEMENT_TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[];

export function isMovementType(value: string): value is StockMovementType {
  return (MOVEMENT_TYPES as string[]).includes(value);
}

/** Taille de page — assez pour balayer une journée, assez peu pour rester lisible. */
export const MOVEMENTS_PAGE_SIZE = 50;

export type MovementRow = {
  id: string;
  createdAt: Date;
  type: StockMovementType;
  productId: string;
  productName: string;
  variantLabel: string | null;
  /** Unité de base du produit, pour lire les quantités. */
  unit: string;
  change: number;
  before: number;
  after: number;
  reason: string | null;
  actor: string | null;
};

export async function listStockMovements(
  storeId: string,
  options: {
    type?: StockMovementType;
    /** Recherche libre sur le nom du produit. */
    search?: string;
    /** Bornes de date incluses, au format `YYYY-MM-DD`. */
    from?: string;
    to?: string;
    page?: number;
  } = {},
): Promise<{ rows: MovementRow[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.InventoryMovementWhereInput = { storeId };
  if (options.type) where.type = options.type;
  if (options.search) {
    where.productVariant = {
      product: { name: { contains: options.search, mode: 'insensitive' } },
    };
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (options.from) {
    const from = new Date(`${options.from}T00:00:00`);
    if (!Number.isNaN(from.getTime())) createdAt.gte = from;
  }
  if (options.to) {
    // Borne haute inclusive : saisir le 12 doit inclure toute la journée du 12,
    // sinon un mouvement de 15 h passe à la trappe sans que personne comprenne.
    const to = new Date(`${options.to}T23:59:59.999`);
    if (!Number.isNaN(to.getTime())) createdAt.lte = to;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const [total, movements] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * MOVEMENTS_PAGE_SIZE,
      take: MOVEMENTS_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        type: true,
        quantityChange: true,
        quantityBefore: true,
        quantityAfter: true,
        reason: true,
        userId: true,
        productVariant: {
          select: {
            attributes: true,
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
                variantAxes: true,
                // `baseUnit` fait autorité ; `unit` n'est qu'un repli pour les
                // fiches antérieures au moteur d'unités.
                baseUnit: { select: { label: true, labelPlural: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // `InventoryMovement.userId` est une colonne libre, sans clé étrangère : un
  // employé retiré de l'équipe ne doit jamais effacer la trace de ce qu'il a
  // fait. On résout donc les noms séparément, en tolérant les absents.
  const userIds = [...new Set(movements.map((m) => m.userId).filter((id): id is string => !!id))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return {
    rows: movements.map((movement) => {
      const axes = parseVariantAxes(movement.productVariant.product.variantAxes);
      return {
        id: movement.id,
        createdAt: movement.createdAt,
        type: movement.type,
        productId: movement.productVariant.product.id,
        productName: movement.productVariant.product.name,
        variantLabel: variantLabel(
          (movement.productVariant.attributes ?? {}) as Record<string, string>,
          axes,
        ),
        unit:
          movement.productVariant.product.baseUnit?.labelPlural ??
          movement.productVariant.product.baseUnit?.label ??
          UNIT_LABELS[movement.productVariant.product.unit] ??
          '',
        change: toQty(movement.quantityChange),
        before: toQty(movement.quantityBefore),
        after: toQty(movement.quantityAfter),
        reason: movement.reason,
        actor: movement.userId ? (nameById.get(movement.userId) ?? 'Compte supprimé') : null,
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE)),
  };
}
