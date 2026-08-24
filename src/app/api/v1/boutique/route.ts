import { ok, route } from '@/lib/api';
import { requireApiKeyStore } from '@/lib/boutique/api-auth';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/** GET /api/v1/boutique — informations de base sur la boutique authentifiée. */
export const GET = route(async (request) => {
  const store = await requireApiKeyStore(request);
  await hit(`api-v1:${store.id}`, RATE_LIMITS.apiPublic);

  return ok({
    id: store.id,
    name: store.name,
    slug: store.slug,
    currency: store.currency,
    status: store.status,
  });
});
