/**
 * Politique de sécurité du contenu (CSP).
 *
 * Elle vivait dans `next.config.ts`, ce qui interdisait toute valeur variable :
 * les en-têtes y sont calculés une fois au démarrage, jamais par requête. Or un
 * nonce n'a de sens que s'il change à chaque réponse — un nonce fixe est
 * exactement aussi permissif qu'`unsafe-inline`, en plus obscur.
 *
 * Elle est donc construite ici, appelée par le middleware, et elle existe en
 * **un seul exemplaire** : une politique recopiée à deux endroits finit par
 * diverger, et la moitié la plus laxiste l'emporte sans que rien ne le signale.
 *
 * ## Ce que `unsafe-inline` coûtait
 *
 * `script-src` l'autorisait, c'est-à-dire que **n'importe quel `<script>`
 * injecté dans une page s'exécutait**. C'est la faille qui vide une CSP de son
 * intérêt principal : elle continue de bloquer les scripts venus d'ailleurs,
 * mais plus ceux qu'un attaquant parvient à écrire dans la page elle-même —
 * et c'est la forme la plus courante du problème.
 *
 * Le nonce le remplace : le navigateur n'exécute un script inline que s'il
 * porte le jeton de cette réponse-là. Un script injecté ne peut pas le
 * connaître, puisqu'il est tiré au sort à chaque requête.
 *
 * ## Ce qui a été vérifié avant de retirer `unsafe-inline`
 *
 * - Les scripts d'hydratation de Next reçoivent le nonce automatiquement, dès
 *   lors que l'en-tête est posé sur la **requête** par le middleware.
 * - GA4 et le pixel Meta passent par `next/script`, qui reçoit le même nonce.
 * - Turnstile et `fbevents.js` sont des scripts externes : ils relèvent de la
 *   liste d'hôtes ci-dessous, pas de l'inline.
 * - Les données structurées sont du `application/ld+json`, que le navigateur
 *   n'exécute pas.
 *
 * `'strict-dynamic'` n'est volontairement pas utilisé : il ferait **ignorer**
 * la liste d'hôtes, et tout script tiers dépendrait alors d'avoir été chargé
 * par un script déjà noncé. Le pixel Meta, qui s'insère lui-même dans le
 * document, en dépendrait entièrement. La liste d'hôtes est plus explicite et
 * se relit.
 *
 * `style-src` garde `unsafe-inline` : React écrit des styles en ligne (la
 * couleur de marque de chaque restaurant, notamment) et il n'existe pas
 * d'équivalent du nonce qui survive au rendu côté client sans réécrire la
 * façon dont le produit applique ses thèmes. C'est un risque d'une autre
 * nature — un style injecté ne s'exécute pas.
 */

export function contentSecurityPolicy(nonce: string, storageHost?: string): string {
  return [
    "default-src 'self'",
    // googletagmanager.com / connect.facebook.net : chargement conditionnel
    // (après consentement) de Google Analytics et du pixel Meta — voir
    // `cookie-consent.tsx` — utilisés à la fois par le site MagyaPro et par
    // les réglages d'analytics propres à chaque tenant
    // (`googleAnalyticsId` / `metaPixelId` sur les sites publics r/[host]).
    // challenges.cloudflare.com : widget anti-robot Turnstile.
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://www.googletagmanager.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: https:${storageHost ? ` https://${storageHost}` : ''}`,
    // Sans cette directive, `media-src` retombe sur `default-src 'self'` et
    // bloque silencieusement la lecture du son de notification personnalisé
    // (hébergé sur le stockage objet, jamais sur ce domaine) — l'audio
    // affiche alors 0:00 / 0:00 sans jamais charger, malgré un
    // téléversement réussi côté serveur.
    `media-src 'self'${storageHost ? ` https://${storageHost}` : ''}`,
    "font-src 'self' data:",
    "frame-src https://challenges.cloudflare.com",
    "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://www.google-analytics.com https://*.google-analytics.com https://www.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/**
 * Jeton à usage unique, tiré au sort pour une seule réponse.
 *
 * `crypto.randomUUID()` est disponible sur le runtime Edge, où le middleware
 * s'exécute ; `Buffer` ne l'est pas, d'où `btoa`.
 */
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * Nonce de la requête en cours, pour un composant serveur.
 *
 * Next.js appose le nonce sur **ses** scripts — hydratation, chargement des
 * bundles — dès que le middleware le pose sur la requête. Il ne le fait pas
 * pour les scripts inline confiés à `next/script` : ceux-là doivent le
 * recevoir explicitement.
 *
 * Mesuré avant de le découvrir : sans cette prop, accepter les cookies
 * produisait deux violations `script-src-elem → inline`, et ni `gtag` ni `fbq`
 * n'existaient dans la page. La mesure d'audience s'arrêtait donc en silence —
 * un tableau de bord d'analytics vide ne ressemble pas à une panne, il
 * ressemble à une absence de visiteurs.
 */
export async function nonceFromHeaders(): Promise<string | null> {
  const { headers } = await import('next/headers');
  return (await headers()).get('x-nonce');
}
