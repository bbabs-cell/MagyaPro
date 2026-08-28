import { ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { cleanStoreDemos, resetStoreDemos, seedStoreDemos } from '@/lib/boutique/demo-seed';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/** Crée les boutiques de démonstration (une par secteur) — voir `seedStoreDemos`. */
export const POST = route(async () => {
  const admin = await requireSuperAdmin();
  const result = await seedStoreDemos();

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DEMO_SEEDED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    metadata: result,
  });

  return ok(result);
});

/**
 * Réinitialise les boutiques de démonstration : suppression puis recréation
 * complète — voir `resetStoreDemos`. Une démo se salit à l'usage, et il faut
 * pouvoir la remettre à neuf en une action plutôt qu'en deux.
 */
export const PUT = route(async () => {
  const admin = await requireSuperAdmin();
  const result = await resetStoreDemos();

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DEMO_RESET,
    actorUserId: admin.id,
    actorEmail: admin.email,
    metadata: result,
  });

  return ok(result);
});

/** Retire toutes les boutiques de démonstration — voir `cleanStoreDemos`. */
export const DELETE = route(async () => {
  const admin = await requireSuperAdmin();
  const result = await cleanStoreDemos();

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DEMO_CLEANED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    metadata: result,
  });

  return ok(result);
});
