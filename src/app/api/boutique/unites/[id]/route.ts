import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  labelPlural: z.string().trim().max(40).optional(),
  isActive: z.boolean().optional(),
  isDecimal: z.boolean().optional(),
  defaultFactor: z.number().positive().max(1_000_000).nullable().optional(),
});

/**
 * Renomme, active ou désactive une unité de la boutique.
 *
 * Désactiver plutôt que supprimer est la voie normale : l'unité disparaît des
 * listes de saisie mais reste lisible partout où l'historique la cite. Le
 * `code` n'est jamais modifié — c'est lui qui relie une unité renommée aux
 * fiches qui l'utilisent déjà.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;

  const unit = await prisma.storeUnit.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!unit) throw new NotFoundError('Unité introuvable.');

  const input = parseOrThrow(updateSchema, await readJson(request));

  // Une unité de base encore utilisée ne peut pas être désactivée : les
  // produits qui la référencent deviendraient invendables, faute d'unité de
  // saisie et d'affichage.
  if (input.isActive === false) {
    const usedAsBase = await prisma.storeProduct.count({
      where: { storeId: context.store.id, baseUnitId: id },
    });
    if (usedAsBase > 0) {
      throw new ConflictError(
        `« ${unit.label} » est l'unité de stock de ${usedAsBase} produit${usedAsBase > 1 ? 's' : ''} : elle ne peut pas être désactivée.`,
      );
    }
  }

  const updated = await prisma.storeUnit.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.labelPlural !== undefined ? { labelPlural: input.labelPlural || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isDecimal !== undefined ? { isDecimal: input.isDecimal } : {}),
      ...(input.defaultFactor !== undefined ? { defaultFactor: input.defaultFactor } : {}),
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_unit',
    targetId: id,
    metadata: { label: updated.label, isActive: updated.isActive },
  });

  return ok({ unit: updated });
});

/**
 * Supprime définitivement une unité — uniquement si rien ne la référence.
 * Une unité déjà utilisée par une fiche produit doit être désactivée, pas
 * supprimée : son libellé reste nécessaire pour relire l'historique.
 */
export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;

  const unit = await prisma.storeUnit.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!unit) throw new NotFoundError('Unité introuvable.');

  const [usedAsBase, usedAsPack] = await Promise.all([
    prisma.storeProduct.count({ where: { storeId: context.store.id, baseUnitId: id } }),
    prisma.storeVariantUnit.count({ where: { unitId: id } }),
  ]);

  if (usedAsBase + usedAsPack > 0) {
    throw new ConflictError(
      `« ${unit.label} » est utilisée par des produits. Désactivez-la plutôt que de la supprimer.`,
    );
  }
  if (!unit.isCustom) {
    throw new ValidationError(
      `« ${unit.label} » fait partie des unités standard. Désactivez-la si vous ne l'utilisez pas.`,
    );
  }

  await prisma.storeUnit.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_unit',
    targetId: id,
    metadata: { deleted: unit.label },
  });

  return ok({ success: true });
});
