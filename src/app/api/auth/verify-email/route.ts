import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { verifyEmail } from '@/lib/auth/service';

const schema = z.object({ token: z.string().min(10).max(200) });

export const POST = route(async (request) => {
  const { token } = parseOrThrow(schema, await readJson(request));
  await verifyEmail(token);

  return ok({ message: 'Votre adresse email est confirmée.' });
});
