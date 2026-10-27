import { Prisma } from '@prisma/client';

/**
 * Violation d'une contrainte d'unicité portant sur `field`.
 *
 * Les colonnes en cause ne sont pas rangées au même endroit selon le moteur :
 * le client Prisma classique remplit `meta.target`, l'adaptateur de base de
 * données employé ici les place dans
 * `meta.driverAdapterError.cause.constraint.fields`, entre guillemets. Une
 * première version ne lisait que `target` : elle ne reconnaissait jamais le
 * conflit, et deux renvois simultanés d'une vente faisaient échouer la
 * seconde tentative au lieu de rendre la vente. Le test de concurrence l'a
 * montré.
 */
export function isUniqueConflictOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;
  const fields = [meta?.target, meta?.driverAdapterError?.cause?.constraint?.fields]
    .flatMap((value) => (Array.isArray(value) ? value : value == null ? [] : [value]))
    .map((name) => String(name).replaceAll('"', ''));
  return fields.includes(field);
}
