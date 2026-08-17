/**
 * Suivi d'erreurs Sentry — appel direct à l'API d'ingestion HTTP plutôt que
 * le SDK officiel `@sentry/nextjs`. Ce SDK ne fonctionne pas de façon fiable
 * sur ce déploiement (Next.js via OpenNext sur Cloudflare Workers) : il
 * repose sur `AsyncLocalStorage` et des instrumentations Node.js absentes de
 * ce runtime, documenté comme cassant le build ou faisant échouer les
 * requêtes. L'API d'ingestion elle-même (`/api/<projet>/store/`) est stable
 * et publique ; un simple `fetch` suffit et fonctionne aussi bien côté
 * Worker que dans le navigateur.
 */

declare global {
  interface Window {
    /** DSN Sentry, posé par le layout racine (voir `app/layout.tsx`) — jamais inliné au build. */
    __SENTRY_DSN__?: string;
  }
}

type SentryDsn = { publicKey: string; host: string; projectId: string };

function parseDsn(dsn: string): SentryDsn | null {
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, publicKey, host, projectId] = match;
  return { publicKey: publicKey!, host: host!, projectId: projectId! };
}

function randomEventId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Envoie une exception à Sentry. Best-effort : une erreur réseau ou un DSN
 * invalide sont avalés plutôt que remontés, pour ne jamais transformer un
 * problème de suivi d'erreurs en panne supplémentaire.
 */
export async function reportToSentry(
  dsn: string | undefined,
  error: unknown,
  context: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {},
): Promise<void> {
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const message = error instanceof Error ? error.message : String(error);
  const type = error instanceof Error ? error.name : 'Error';
  const stack = error instanceof Error ? error.stack : undefined;

  const payload = {
    event_id: randomEventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    server_name: 'magyapro',
    exception: { values: [{ type, value: message }] },
    tags: context.tags,
    extra: { ...context.extra, stack },
  };

  const url = `https://${parsed.host}/api/${parsed.projectId}/store/`;
  const auth = `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=magyapro-custom/1.0`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': auth },
      body: JSON.stringify(payload),
    });
  } catch {
    // Le suivi d'erreurs ne doit jamais devenir lui-même une source d'échec.
  }
}
