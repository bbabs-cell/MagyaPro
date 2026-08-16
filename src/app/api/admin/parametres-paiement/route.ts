import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { updatePlatformSettings } from '@/lib/platform-settings';

const schema = z.object({
  waveNumber: z.string().max(30).nullable().optional(),
  orangeMoneyNumber: z.string().max(30).nullable().optional(),
  promoDiscountPercent: z.number().int().min(1).max(90).nullable().optional(),
  promoEndsAt: z.coerce.date().nullable().optional(),
  promoLabel: z.string().max(120).nullable().optional(),
});

/** Numéros Wave/Orange Money de la plateforme, receveurs des paiements d'abonnement. */
export const POST = route(async (request) => {
  await requireSuperAdmin();
  const input = parseOrThrow(schema, await readJson(request));

  const settings = await updatePlatformSettings(input);
  return ok({ settings });
});
