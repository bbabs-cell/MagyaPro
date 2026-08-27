import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';
import { ValidationError } from '@/lib/errors';
import {
  LEGACY_UNIT_CODES,
  UNIT_CATALOGUE,
  unitCodesForSector,
} from '@/lib/boutique/unit-catalogue';

/**
 * Moteur d'unités et de conversions.
 *
 * Deux règles gouvernent tout ce fichier, et rien d'autre dans l'application
 * n'a le droit de les contourner :
 *
 * 1. Le stock est TOUJOURS compté dans l'unité de base du produit. Un carton
 *    n'est jamais stocké — c'est une façon de saisir et d'afficher, convertie
 *    à l'écriture par `toBaseQuantity` et recalculée à l'affichage par
 *    `splitIntoUnits`. Sans cette règle, corriger une conversion réécrirait
 *    rétroactivement le stock et tout l'historique.
 *
 * 2. Un facteur lu ici est figé sur la ligne qu'il produit (vente, achat,
 *    mouvement). Jamais relu pour réafficher une opération passée : un ticket
 *    déjà encaissé ne doit pas changer parce que le commerçant a corrigé la
 *    taille de ses cartons ce matin.
 */

/** Une unité utilisable pour une variante, résolue avec son facteur et ses prix. */
export type ResolvedUnit = {
  unitId: string;
  code: string;
  label: string;
  labelPlural: string;
  isDecimal: boolean;
  /** Nombre d'unités de base contenues — 1 pour l'unité de base elle-même. */
  factor: number;
  price: number | null;
  cost: number | null;
  isSellable: boolean;
  isPurchasable: boolean;
  isBase: boolean;
};

/**
 * Sème les unités par défaut d'une boutique selon son secteur. Idempotent :
 * relancé sur une boutique déjà pourvue, il n'ajoute que les unités
 * manquantes et ne touche jamais à celles que le commerçant a renommées,
 * désactivées ou créées lui-même.
 */
export async function seedStoreUnits(
  storeId: string,
  sector: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const codes = unitCodesForSector(sector);

  const existing = await tx.storeUnit.findMany({
    where: { storeId },
    select: { code: true },
  });
  const known = new Set(existing.map((unit) => unit.code));

  const missing = codes.filter((code) => !known.has(code));
  if (missing.length === 0) return;

  await tx.storeUnit.createMany({
    data: missing.map((code, index) => {
      const definition = UNIT_CATALOGUE[code]!;
      return {
        storeId,
        code: definition.code,
        label: definition.label,
        labelPlural: definition.labelPlural,
        isDecimal: definition.isDecimal,
        position: known.size + index,
      };
    }),
    skipDuplicates: true,
  });
}

/**
 * Garantit qu'une boutique dispose d'une unité pour un code donné, en la
 * créant au besoin — utilisé par la reprise des fiches antérieures au moteur
 * d'unités, dont l'unité héritée peut ne pas figurer dans le profil du
 * secteur (une épicerie qui vendait au mètre, par exemple).
 */
export async function ensureStoreUnit(
  storeId: string,
  code: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const existing = await tx.storeUnit.findUnique({
    where: { storeId_code: { storeId, code } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const definition = UNIT_CATALOGUE[code];
  if (!definition) {
    throw new ValidationError(`Unité inconnue : ${code}.`);
  }

  const created = await tx.storeUnit.create({
    data: {
      storeId,
      code: definition.code,
      label: definition.label,
      labelPlural: definition.labelPlural,
      isDecimal: definition.isDecimal,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Unité de base d'un produit, avec repli sur l'ancien enum `ProductUnit` pour
 * les fiches antérieures au moteur d'unités — l'unité correspondante est
 * créée à la volée pour la boutique. Aucune fiche existante n'a donc besoin
 * d'être ressaisie.
 */
export async function resolveBaseUnitId(
  params: { storeId: string; productId: string },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const product = await tx.storeProduct.findUniqueOrThrow({
    where: { id: params.productId },
    select: { baseUnitId: true, unit: true },
  });

  if (product.baseUnitId) return product.baseUnitId;

  const code = LEGACY_UNIT_CODES[product.unit] ?? 'PIECE';
  const unitId = await ensureStoreUnit(params.storeId, code, tx);

  await tx.storeProduct.update({
    where: { id: params.productId },
    data: { baseUnitId: unitId },
  });
  return unitId;
}

/**
 * Toutes les unités dans lesquelles une variante peut être achetée, stockée
 * ou vendue. L'unité de base y figure toujours, même sans ligne
 * `StoreVariantUnit` dédiée : c'est elle qui porte le prix et le coût de la
 * fiche produit, et une variante sans conditionnement déclaré doit rester
 * vendable.
 */
export async function resolveVariantUnits(
  params: { storeId: string; productVariantId: string },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ResolvedUnit[]> {
  const variant = await tx.storeProductVariant.findUniqueOrThrow({
    where: { id: params.productVariantId },
    select: {
      price: true,
      cost: true,
      productId: true,
      product: { select: { baseUnitId: true, unit: true } },
      units: { include: { unit: true }, orderBy: { position: 'asc' } },
    },
  });

  const baseUnitId =
    variant.product.baseUnitId ??
    (await resolveBaseUnitId({ storeId: params.storeId, productId: variant.productId }, tx));

  const resolved: ResolvedUnit[] = [];
  let baseSeen = false;

  for (const row of variant.units) {
    const isBase = row.unitId === baseUnitId;
    if (isBase) baseSeen = true;
    resolved.push({
      unitId: row.unitId,
      code: row.unit.code,
      label: row.unit.label,
      labelPlural: row.unit.labelPlural ?? row.unit.label,
      isDecimal: row.unit.isDecimal,
      // Le facteur de l'unité de base vaut 1 par définition : une ligne
      // enregistrée avec une autre valeur serait une incohérence de saisie,
      // neutralisée ici plutôt que propagée jusqu'au stock.
      factor: isBase ? 1 : toQty(row.factor),
      price: isBase ? (row.price ?? variant.price) : row.price,
      cost: isBase ? (row.cost ?? variant.cost) : row.cost,
      isSellable: row.isSellable,
      isPurchasable: row.isPurchasable,
      isBase,
    });
  }

  if (!baseSeen) {
    const base = await tx.storeUnit.findUniqueOrThrow({ where: { id: baseUnitId } });
    resolved.unshift({
      unitId: base.id,
      code: base.code,
      label: base.label,
      labelPlural: base.labelPlural ?? base.label,
      isDecimal: base.isDecimal,
      factor: 1,
      price: variant.price,
      cost: variant.cost,
      isSellable: true,
      isPurchasable: true,
      isBase: true,
    });
  }

  // L'unité de base d'abord, puis les conditionnements du plus petit au plus
  // grand — l'ordre dans lequel une caisse les propose naturellement.
  return resolved.sort((a, b) => (a.isBase ? -1 : b.isBase ? 1 : a.factor - b.factor));
}

/**
 * Convertit une quantité saisie dans une unité donnée vers l'unité de base.
 * Point de passage obligatoire avant toute écriture de stock.
 */
export function toBaseQuantity(quantity: number, factor: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(factor) || factor <= 0) {
    throw new ValidationError('Conversion d’unité invalide.');
  }
  // Arrondi à la précision de stockage (6 décimales) pour qu'une quantité
  // écrite en base soit exactement celle relue ensuite.
  return Math.round(quantity * factor * 1_000_000) / 1_000_000;
}

/** Opération inverse — pour réafficher une quantité de base dans une unité. */
export function fromBaseQuantity(baseQuantity: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new ValidationError('Conversion d’unité invalide.');
  }
  return Math.round((baseQuantity / factor) * 1_000_000) / 1_000_000;
}

/**
 * Version groupée de `resolveVariantUnits`, pour les écrans qui affichent tout
 * un catalogue (caisse, liste produits) : deux requêtes au total au lieu
 * d'une par variante.
 *
 * Les variantes dont le produit n'a pas encore d'unité de base (fiche
 * antérieure au moteur) sont simplement omises de la carte — l'appelant
 * retombe alors sur le prix et l'unité hérités de la fiche, et la reprise se
 * fera au prochain passage de `ensureStoreUnitsReady`.
 */
export async function resolveVariantUnitsBulk(
  variantIds: string[],
): Promise<Map<string, ResolvedUnit[]>> {
  const result = new Map<string, ResolvedUnit[]>();
  if (variantIds.length === 0) return result;

  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      price: true,
      cost: true,
      product: { select: { baseUnitId: true } },
      units: { include: { unit: true }, orderBy: { position: 'asc' } },
    },
  });

  const baseUnitIds = [
    ...new Set(variants.map((v) => v.product.baseUnitId).filter((id): id is string => Boolean(id))),
  ];
  const baseUnits = await prisma.storeUnit.findMany({ where: { id: { in: baseUnitIds } } });
  const baseUnitById = new Map(baseUnits.map((unit) => [unit.id, unit]));

  for (const variant of variants) {
    const baseUnitId = variant.product.baseUnitId;
    if (!baseUnitId) continue;
    const base = baseUnitById.get(baseUnitId);
    if (!base) continue;

    const resolved: ResolvedUnit[] = [
      {
        unitId: base.id,
        code: base.code,
        label: base.label,
        labelPlural: base.labelPlural ?? base.label,
        isDecimal: base.isDecimal,
        factor: 1,
        price: variant.price,
        cost: variant.cost,
        isSellable: true,
        isPurchasable: true,
        isBase: true,
      },
    ];

    for (const row of variant.units) {
      if (row.unitId === baseUnitId) continue;
      resolved.push({
        unitId: row.unitId,
        code: row.unit.code,
        label: row.unit.label,
        labelPlural: row.unit.labelPlural ?? row.unit.label,
        isDecimal: row.unit.isDecimal,
        factor: toQty(row.factor),
        price: row.price,
        cost: row.cost,
        isSellable: row.isSellable,
        isPurchasable: row.isPurchasable,
        isBase: false,
      });
    }

    resolved.sort((a, b) => (a.isBase ? -1 : b.isBase ? 1 : a.factor - b.factor));
    result.set(variant.id, resolved);
  }

  return result;
}

/**
 * Prépare une boutique au moteur d'unités, sans rien demander au commerçant :
 * sème les unités de son secteur, donne une unité de base à chaque fiche
 * existante d'après son unité héritée, et convertit les « prix carton »
 * saisis avant le moteur en vraies conversions.
 *
 * Idempotent et paresseux : appelé au chargement des écrans Produits et
 * Caisse, il ne fait un vrai travail qu'une seule fois par boutique. Les
 * appels suivants s'arrêtent au premier comptage.
 */
export async function ensureStoreUnitsReady(storeId: string, sector: string): Promise<void> {
  const alreadySeeded = await prisma.storeUnit.count({ where: { storeId } });
  if (alreadySeeded > 0) return;

  await prisma.$transaction(async (tx) => {
    await seedStoreUnits(storeId, sector, tx);

    const products = await tx.storeProduct.findMany({
      where: { storeId, baseUnitId: null },
      select: {
        id: true,
        unit: true,
        variants: {
          select: { id: true, packSize: true, packCost: true, packPrice: true },
        },
      },
    });
    if (products.length === 0) return;

    // Les unités sont peu nombreuses par boutique : les charger une fois évite
    // une requête par fiche pendant la reprise.
    const units = await tx.storeUnit.findMany({ where: { storeId }, select: { id: true, code: true } });
    const unitIdByCode = new Map(units.map((unit) => [unit.code, unit.id]));

    let cartonId = unitIdByCode.get('CARTON') ?? null;

    for (const product of products) {
      const code = LEGACY_UNIT_CODES[product.unit] ?? 'PIECE';
      let baseUnitId = unitIdByCode.get(code);
      if (!baseUnitId) {
        // Le secteur de la boutique ne sème pas cette unité (une épicerie qui
        // vendait au mètre) : elle est créée à la volée plutôt que de perdre
        // l'unité choisie par le commerçant.
        baseUnitId = await ensureStoreUnit(storeId, code, tx);
        unitIdByCode.set(code, baseUnitId);
      }

      await tx.storeProduct.update({ where: { id: product.id }, data: { baseUnitId } });

      for (const variant of product.variants) {
        if (!variant.packSize || variant.packSize <= 1) continue;
        if (!cartonId) {
          cartonId = await ensureStoreUnit(storeId, 'CARTON', tx);
          unitIdByCode.set('CARTON', cartonId);
        }
        // Le carton d'un produit dont l'unité de base EST déjà le carton
        // n'aurait aucun sens : ignoré plutôt que de créer un facteur sur
        // lui-même.
        if (cartonId === baseUnitId) continue;

        await tx.storeVariantUnit.create({
          data: {
            productVariantId: variant.id,
            unitId: cartonId,
            factor: variant.packSize,
            price: variant.packPrice,
            cost: variant.packCost,
            position: 1,
          },
        });
      }
    }
  });
}

/**
 * Unité de base demandée par une fiche produit, vérifiée comme appartenant
 * bien à la boutique — un identifiant venu du client n'est jamais utilisé tel
 * quel. Sans demande explicite, la première unité du profil du secteur sert
 * de base (la pièce pour l'habillement, le mètre pour la mercerie).
 */
export async function resolveRequestedBaseUnit(
  store: { id: string; businessType: string },
  requestedUnitId: string | null | undefined,
): Promise<string> {
  await ensureStoreUnitsReady(store.id, store.businessType);

  if (requestedUnitId) {
    const unit = await prisma.storeUnit.findFirst({
      where: { id: requestedUnitId, storeId: store.id },
      select: { id: true },
    });
    if (!unit) throw new ValidationError('Unité de base inconnue pour cette boutique.');
    return unit.id;
  }

  const defaultCode = unitCodesForSector(store.businessType)[0] ?? 'PIECE';
  return ensureStoreUnit(store.id, defaultCode);
}

/**
 * Contrôle les conditionnements saisis sur une fiche avant écriture : unités
 * réellement possédées par la boutique, pas de doublon, pas de conversion
 * absurde, et jamais l'unité de base elle-même (son facteur vaut 1 par
 * définition, la déclarer serait une seconde source de vérité).
 */
export async function validateVariantUnits(
  storeId: string,
  baseUnitId: string,
  units: Array<{
    unitId: string;
    factor: number;
    price?: number | null;
    cost?: number | null;
    isSellable: boolean;
    isPurchasable: boolean;
  }>,
): Promise<
  Array<{
    unitId: string;
    factor: number;
    price: number | null;
    cost: number | null;
    isSellable: boolean;
    isPurchasable: boolean;
    position: number;
  }>
> {
  if (units.length === 0) return [];

  const ids = units.map((unit) => unit.unitId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError('La même unité est déclarée deux fois sur ce produit.');
  }

  const owned = await prisma.storeUnit.findMany({
    where: { id: { in: ids }, storeId },
    select: { id: true, label: true },
  });
  const labelById = new Map(owned.map((unit) => [unit.id, unit.label]));

  return units.map((unit, index) => {
    const label = labelById.get(unit.unitId);
    if (!label) throw new ValidationError('Unité inconnue pour cette boutique.');
    if (unit.unitId === baseUnitId) {
      throw new ValidationError(
        `« ${label} » est déjà l'unité de base de ce produit : sa conversion vaut 1.`,
      );
    }
    assertValidFactor(unit.factor, label);
    if (unit.isSellable && (unit.price === null || unit.price === undefined)) {
      throw new ValidationError(`Indiquez un prix de vente pour « ${label} », ou rendez-la non vendable.`);
    }
    return {
      unitId: unit.unitId,
      factor: unit.factor,
      price: unit.price ?? null,
      cost: unit.cost ?? null,
      isSellable: unit.isSellable,
      isPurchasable: unit.isPurchasable,
      position: index + 1,
    };
  });
}

/**
 * Vérifie qu'un facteur saisi par le commerçant est utilisable. Un facteur
 * nul, négatif ou absurde rendrait le stock incalculable — refusé à la
 * saisie plutôt que découvert à la première vente.
 */
export function assertValidFactor(factor: number, unitLabel: string): void {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new ValidationError(
      `La conversion de « ${unitLabel} » doit être un nombre supérieur à zéro.`,
      { factor: 'Supérieur à zéro.' },
    );
  }
  if (factor > 1_000_000) {
    throw new ValidationError(`La conversion de « ${unitLabel} » est trop grande.`, {
      factor: 'Valeur trop élevée.',
    });
  }
}
