/**
 * Nettoyage du motif d'échec d'un paiement avant persistance et affichage.
 *
 * Le problème : le message d'erreur d'un fournisseur est repris tel quel. Wave,
 * par exemple, lève `Wave a refusé la demande (401) : <corps de la réponse>`.
 * Ce corps est écrit par un service tiers et peut contenir n'importe quoi — un
 * écho de la requête, une URL avec sa clé d'API en paramètre, un en-tête
 * d'autorisation. Il était stocké intact dans `Payment.failureReason`, puis
 * affiché intact au restaurateur.
 *
 * Deux angles, tous deux traités ici :
 *
 * 1. **Fuite.** Un secret qui atterrit en base y reste, et une base
 *    sauvegardée circule. On masque avant d'écrire, pas seulement avant
 *    d'afficher.
 * 2. **Lisibilité.** « fetch failed: ECONNRESET » ne dit rien à un
 *    restaurateur. Les cas connus sont traduits en une phrase actionnable ;
 *    le détail technique nettoyé reste en queue, pour l'assistance.
 *
 * Ce module ne fait aucune supposition sur le fournisseur : il travaille sur
 * la forme du texte. Un nouveau moyen de paiement est donc couvert d'office.
 */

/** Au-delà, le message n'est plus lu — ni par un humain, ni utilement en base. */
const MAX_LENGTH = 240;

/**
 * Motifs masqués, dans l'ordre. Chacun cible une forme de secret plutôt qu'un
 * fournisseur donné : c'est ce qui les rend valables pour le prochain.
 */
const REDACTIONS: Array<{ pattern: RegExp; replace: string }> = [
  // `Bearer eyJhbGci...`, `Basic dXNlcjpwYXNz`
  { pattern: /\b(bearer|basic)\s+[\w\-._~+/=]+/gi, replace: '$1 [masqué]' },
  // `api_key=...`, `"token": "..."`, `secret: ...` — séparateur =, : ou ": "
  {
    pattern: /\b(api[_-]?key|apikey|token|secret|password|passwd|authorization|signature)\b["']?\s*[:=]\s*["']?[^\s"',&}]+/gi,
    replace: '$1=[masqué]',
  },
  // Paramètres de requête d'une URL : c'est là que se cachent les clés.
  { pattern: /(https?:\/\/[^\s"'<>]+?)\?[^\s"'<>]*/gi, replace: '$1?[masqué]' },
  // Suite longue de caractères de jeton, sans espace : clé nue échappée d'un
  // format non couvert ci-dessus.
  { pattern: /\b[A-Za-z0-9_-]{32,}\b/g, replace: '[masqué]' },
];

/**
 * Traductions des échecs courants. La clé est cherchée en minuscules dans le
 * message d'origine ; la première correspondance gagne, du plus précis au plus
 * général.
 */
const KNOWN_CAUSES: Array<{ match: RegExp; message: string }> = [
  {
    match: /\bn'est pas configuré\b|\bmanquant\b/i,
    message: 'Ce moyen de paiement n’est pas encore configuré.',
  },
  {
    // Le code n'est reconnu qu'isolé — en début de message, entre espaces ou
    // entre parenthèses. Sans cette précaution, `amount=500` était lu comme
    // une erreur serveur, et le restaurateur envoyé sur la mauvaise piste.
    match: /(?:^|[\s(])(401|403)(?:[\s)]|$)|\b(unauthorized|forbidden|invalid[_\s-]?(api[_\s-]?)?key)\b/i,
    message: 'Le fournisseur a refusé nos identifiants. Vérifiez la configuration du moyen de paiement.',
  },
  {
    match: /\b(insufficient|solde insuffisant|balance)\b/i,
    message: 'Fonds insuffisants sur le compte du client.',
  },
  {
    match: /\b(timeout|etimedout|econnreset|econnrefused|enotfound|fetch failed|network)\b/i,
    message: 'Le service de paiement était injoignable. Le client peut réessayer.',
  },
  {
    match: /(?:^|[\s(])429(?:[\s)]|$)|\b(rate[_\s-]?limit|too many requests)\b/i,
    message: 'Trop de demandes envoyées au fournisseur. Réessayez dans quelques minutes.',
  },
  {
    match: /(?:^|[\s(])5\d{2}(?:[\s)]|$)|\b(internal server error|service unavailable)\b/i,
    message: 'Le service de paiement rencontre une panne de son côté.',
  },
];

/** Retire les secrets d'un texte libre, sans rien interpréter d'autre. */
export function redactSecrets(text: string): string {
  let clean = text;
  for (const { pattern, replace } of REDACTIONS) {
    clean = clean.replace(pattern, replace);
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Motif d'échec prêt à être enregistré et montré au commerçant.
 *
 * Toujours une phrase compréhensible en tête. Le détail technique nettoyé la
 * suit entre parenthèses quand il apporte quelque chose — supprimer toute
 * trace rendrait le diagnostic impossible le jour où il faut appeler le
 * fournisseur.
 */
export function sanitizeFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw.trim()) return 'Échec du paiement, sans détail fourni par le service.';

  const known = KNOWN_CAUSES.find((cause) => cause.match.test(raw));
  const detail = redactSecrets(raw);

  if (!known) return truncate(detail);
  // Le détail n'est ajouté que s'il dit autre chose que la phrase choisie.
  return truncate(`${known.message} (${detail})`);
}

function truncate(text: string): string {
  return text.length <= MAX_LENGTH ? text : `${text.slice(0, MAX_LENGTH - 1)}…`;
}
