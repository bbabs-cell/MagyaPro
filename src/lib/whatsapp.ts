/**
 * Liens WhatsApp « click-to-chat ».
 *
 * `wa.me` ne demande ni compte développeur ni clé d'API : c'est un simple
 * lien qui ouvre WhatsApp (application ou web) avec un message pré-rempli, que
 * l'expéditeur envoie lui-même d'un geste. C'est donc une notification
 * réellement fonctionnelle dès aujourd'hui — contrairement à un envoi
 * automatique par API, qui demanderait un compte WhatsApp Business payant que
 * la plateforme n'a pas encore.
 *
 * Module pur : aucune dépendance Node, utilisable aussi bien dans un
 * composant serveur que client.
 */

/** Ne garde que les chiffres, comme l'exige le format `wa.me/<numéro>`. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const number = digitsOnly(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Message de notification de changement de statut, prêt à l'envoi. */
export function orderStatusWhatsAppMessage(params: {
  restaurantName: string;
  customerName: string;
  orderNumber: number;
  statusLabel: string;
  trackingUrl: string;
}): string {
  return [
    `Bonjour ${params.customerName},`,
    `${params.restaurantName} — votre commande n°${params.orderNumber} est maintenant « ${params.statusLabel} ».`,
    `Suivez-la ici : ${params.trackingUrl}`,
  ].join('\n');
}

// ---------------------------------------------------------------- Numéros

/**
 * Indicatifs de la zone, par nom de pays tel qu'il est saisi dans les
 * réglages (texte libre : « Sénégal », « Cote d'Ivoire », « CI »…).
 */
const DIAL_CODES: Array<{ code: string; names: string[] }> = [
  { code: '221', names: ['senegal', 'sn'] },
  { code: '225', names: ['cote d ivoire', 'cote divoire', 'ivory coast', 'ci'] },
  { code: '223', names: ['mali', 'ml'] },
  { code: '226', names: ['burkina faso', 'burkina', 'bf'] },
  { code: '229', names: ['benin', 'bj'] },
  { code: '228', names: ['togo', 'tg'] },
  { code: '227', names: ['niger', 'ne'] },
  { code: '224', names: ['guinee', 'guinea', 'gn'] },
  { code: '245', names: ['guinee bissau', 'guinea bissau', 'gw'] },
  { code: '222', names: ['mauritanie', 'mauritania', 'mr'] },
  { code: '237', names: ['cameroun', 'cameroon', 'cm'] },
  { code: '241', names: ['gabon', 'ga'] },
  { code: '242', names: ['congo', 'cg'] },
  { code: '235', names: ['tchad', 'chad', 'td'] },
  { code: '236', names: ['centrafrique', 'republique centrafricaine', 'cf'] },
];

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** Indicatif d'un pays saisi librement, ou `null` s'il n'est pas reconnu. */
export function dialCodeFor(country: string | null | undefined): string | null {
  if (!country) return null;
  const name = normalizeName(country);
  // « Guinée-Bissau » avant « Guinée » : la plus longue correspondance gagne.
  const match = DIAL_CODES.flatMap((entry) => entry.names.map((n) => ({ code: entry.code, n })))
    .filter(({ n }) => name === n || name.startsWith(`${n} `) || name.endsWith(` ${n}`))
    .sort((a, b) => b.n.length - a.n.length)[0];
  return match?.code ?? null;
}

/**
 * Numéro au format attendu par `wa.me` (chiffres, indicatif compris), ou
 * `null` quand on ne peut pas le déterminer sans risque.
 *
 * Les clients sont souvent enregistrés sans indicatif (« 77 123 45 67 »).
 * Les envoyer tels quels à `wa.me` ouvrirait la conversation d'un inconnu à
 * l'autre bout du monde. On ajoute donc l'indicatif du pays de la boutique ;
 * s'il est inconnu, mieux vaut laisser le commerçant choisir le contact que
 * deviner.
 *
 * Le zéro de tête d'un numéro local est conservé : en Côte d'Ivoire il fait
 * partie du numéro (07 xx xx xx xx → 225 07 xx xx xx xx).
 */
export function whatsAppNumber(phone: string, country: string | null | undefined): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) return digitsOnly(trimmed) || null;

  const digits = digitsOnly(trimmed);
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2) || null;

  // Déjà international sans le « + » : il commence par un indicatif connu et
  // il est trop long pour un numéro local de la zone (8 à 10 chiffres).
  if (digits.length >= 11 && DIAL_CODES.some(({ code }) => digits.startsWith(code))) {
    return digits;
  }

  const code = dialCodeFor(country);
  return code ? `${code}${digits}` : null;
}

/**
 * Lien WhatsApp vers un client, ou — sans numéro sûr — vers le choix du
 * contact dans WhatsApp, message déjà rédigé.
 */
export function whatsAppLinkFor(
  phone: string | null | undefined,
  country: string | null | undefined,
  message: string,
): string {
  const number = phone ? whatsAppNumber(phone, country) : null;
  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// --------------------------------------------------------------- Messages

export type ReceiptLine = { label: string; quantity: string; total: string };

/**
 * Reçu de caisse, en texte. Pas de lien vers le reçu en ligne : il est
 * réservé à l'équipe de la boutique, le client tomberait sur une page de
 * connexion. Le texte, lui, reste lisible sans réseau, une fois reçu.
 */
export function saleReceiptMessage(params: {
  storeName: string;
  saleNumber: number;
  date: string;
  lines: ReceiptLine[];
  total: string;
  paid?: string | null;
  due?: string | null;
  customerName?: string | null;
}): string {
  const greeting = params.customerName ? `Bonjour ${firstName(params.customerName)},` : 'Bonjour,';
  return [
    greeting,
    `voici votre reçu de ${params.storeName}.`,
    '',
    `Reçu n°${params.saleNumber} — ${params.date}`,
    ...params.lines.map((line) => `• ${line.quantity} ${line.label} : ${line.total}`),
    '',
    `Total : ${params.total}`,
    ...(params.paid ? [`Payé : ${params.paid}`] : []),
    ...(params.due ? [`Reste à payer : ${params.due}`] : []),
    '',
    'Merci de votre confiance !',
  ].join('\n');
}

/**
 * Rappel d'un solde dû, sur un ton qui préserve la relation : le client
 * revient demain, et le commerçant le sait mieux que quiconque.
 */
export function creditReminderMessage(params: {
  storeName: string;
  customerName: string;
  balance: string;
}): string {
  return [
    `Bonjour ${firstName(params.customerName)},`,
    `c'est ${params.storeName}. Petit rappel amical : il reste ${params.balance} à régler sur vos achats chez nous.`,
    'Passez quand cela vous arrange. Merci de votre confiance !',
  ].join('\n');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
