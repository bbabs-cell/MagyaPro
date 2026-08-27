import type { Prisma } from '@prisma/client';

/**
 * Quantités décimales (vente au poids/volume : kg, g, L, mL — voir
 * `ProductUnit`). Stockées en base sur 3 décimales (`Decimal(14,3)`),
 * Prisma les renvoie comme des instances `Decimal`, jamais des `number` —
 * ce module est le point de passage unique qui les convertit en `number`
 * dès la sortie de Prisma, pour que le reste de l'application (calculs,
 * affichage, formulaires) manipule un type simple. Une quantité reste assez
 * petite en pratique (jamais proche de la limite de précision d'un
 * flottant IEEE 754) pour que cette conversion soit sans risque.
 */

export function toQty(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

/** Arrondit à 6 décimales — la précision de stockage en base. */
export function roundQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Formate une quantité pour l'affichage, sans zéros décimaux superflus.
 * Plafonné à 3 décimales : la base en stocke 6 pour ne rien perdre au calcul,
 * mais « 1,5 kg » se lit mieux que « 1,500000 kg » sur un écran de caisse.
 */
export function formatQty(value: Prisma.Decimal | number): string {
  const num = toQty(value);
  return num.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}
