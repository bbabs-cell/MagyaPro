import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { ConflictError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { ensureStoreUnitsReady } from '@/lib/boutique/units-engine';
import { slugify } from '@/lib/slug';

/** Unités d'une boutique — voir `StoreUnit`. */
export const GET = route(async () => {
  const { store } = await requireStore('products:view');
  await ensureStoreUnitsReady(store.id, store.businessType);

  const units = await prisma.storeUnit.findMany({
    where: { storeId: store.id },
    orderBy: [{ isActive: 'desc' }, { position: 'asc' }],
  });

  return ok({ units });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(40),
  labelPlural: z.string().trim().max(40).optional(),
  isDecimal: z.boolean().default(false),
  /** Conversion habituelle, purement indicative — voir `StoreUnit.defaultFactor`. */
  defaultFactor: z.number().positive().max(1_000_000).nullable().optional(),
});

/**
 * Crée une unité propre à la boutique — « Plateau », « Botte », « Casier ».
 * Le code est dérivé du libellé une fois pour toutes : renommer l'unité plus
 * tard ne doit pas casser les fiches qui la référencent.
 */
export const POST = route(async (request) => {
  const context = await requireStore('settings:manage');
  await hit(`boutique-units:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(createSchema, await readJson(request));
  const code = slugify(input.label).toUpperCase().replace(/-/g, '_').slice(0, 40);
  if (!code) {
    throw new ValidationError('Ce nom ne permet pas de créer une unité.', {
      label: 'Utilisez au moins une lettre ou un chiffre.',
    });
  }

  const existing = await prisma.storeUnit.findUnique({
    where: { storeId_code: { storeId: context.store.id, code } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('Cette unité existe déjà dans votre boutique.');

  const count = await prisma.storeUnit.count({ where: { storeId: context.store.id } });

  const unit = await prisma.storeUnit.create({
    data: {
      storeId: context.store.id,
      code,
      label: input.label,
      labelPlural: input.labelPlural || input.label,
      isDecimal: input.isDecimal,
      defaultFactor: input.defaultFactor ?? null,
      isCustom: true,
      position: count,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_unit',
    targetId: unit.id,
    metadata: { label: unit.label },
  });

  return ok({ unit }, 201);
});
