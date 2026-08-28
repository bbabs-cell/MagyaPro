/**
 * Interprétation des commandes vocales — grammaire de règles, sans IA.
 *
 * Module pur : aucune dépendance au navigateur, aucune dépendance serveur.
 * Il transforme une phrase en intention, et rien d'autre. La reconnaissance
 * de la parole elle-même est faite par le navigateur (Web Speech API), sur
 * l'appareil ou par le moteur du système : aucun service payant n'est appelé,
 * aucune clé d'API n'est nécessaire, et la même phrase donne toujours la même
 * interprétation.
 *
 * Le choix d'une grammaire fermée est délibéré. Une caisse doit être
 * prévisible : un vendeur qui répète la même phrase doit obtenir le même
 * résultat, et une phrase mal comprise doit être annoncée comme telle plutôt
 * qu'exécutée « au mieux ». C'est aussi ce qui rend le repli clavier
 * possible — on tape exactement ce qu'on aurait dit.
 */

export type VoiceIntent =
  | { kind: 'add'; quantity: number; unitWord: string | null; query: string }
  | { kind: 'remove'; query: string }
  | { kind: 'clear' }
  | { kind: 'checkout' }
  | { kind: 'search'; query: string }
  | { kind: 'unknown'; transcript: string };

/**
 * Actions qu'on ne déclenche jamais sur une phrase mal comprise : elles
 * touchent à l'argent ou détruisent le panier. Elles passent par une
 * confirmation explicite à l'écran.
 */
export function needsConfirmation(intent: VoiceIntent): boolean {
  return intent.kind === 'checkout' || intent.kind === 'clear' || intent.kind === 'remove';
}

/** Phrases d'aide affichées à l'utilisateur — la grammaire n'est pas devinable. */
export const VOICE_EXAMPLES = [
  'ajoute 3 bouteilles d\'eau',
  'ajoute deux cartons de riz',
  'retire le savon noir',
  'cherche chargeur',
  'vide le panier',
  'encaisse',
];

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
};

/**
 * Mots d'unité reconnus, ramenés à leur singulier. Comparés ensuite au
 * libellé réel des unités du produit : la grammaire ne connaît pas les unités
 * d'une boutique donnée, elle se contente de retenir le mot prononcé.
 */
const UNIT_WORDS: Record<string, string> = {
  piece: 'piece',
  pieces: 'piece',
  paire: 'paire',
  paires: 'paire',
  bouteille: 'bouteille',
  bouteilles: 'bouteille',
  carton: 'carton',
  cartons: 'carton',
  caisse: 'caisse',
  caisses: 'caisse',
  paquet: 'paquet',
  paquets: 'paquet',
  sachet: 'sachet',
  sachets: 'sachet',
  boite: 'boite',
  boites: 'boite',
  sac: 'sac',
  sacs: 'sac',
  plateau: 'plateau',
  plateaux: 'plateau',
  palette: 'palette',
  palettes: 'palette',
  rouleau: 'rouleau',
  rouleaux: 'rouleau',
  bobine: 'bobine',
  bobines: 'bobine',
  bidon: 'bidon',
  bidons: 'bidon',
  lot: 'lot',
  lots: 'lot',
  kilo: 'kg',
  kilos: 'kg',
  kg: 'kg',
  gramme: 'g',
  grammes: 'g',
  litre: 'l',
  litres: 'l',
  metre: 'm',
  metres: 'm',
};

/** Mots vides ignorés dans la recherche du produit. */
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'un', 'une', 'a', 'au']);

/** Minuscules, sans accents, sans ponctuation — la base de toute comparaison. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVoiceCommand(transcript: string): VoiceIntent {
  const text = normalize(transcript);
  if (!text) return { kind: 'unknown', transcript };

  // --- Commandes sans complément ------------------------------------------
  if (/^(encaisse|encaisser|valide|valider|paiement|payer|terminer la vente)\b/.test(text)) {
    return { kind: 'checkout' };
  }
  if (/^(vide|vider|annule|annuler|efface|effacer)\b.*\b(panier|tout)\b/.test(text)) {
    return { kind: 'clear' };
  }

  // --- Retrait -------------------------------------------------------------
  const removeMatch = text.match(/^(retire|retirer|enleve|enlever|supprime|supprimer)\s+(.*)$/);
  if (removeMatch) {
    const query = cleanQuery(removeMatch[2]!);
    return query ? { kind: 'remove', query } : { kind: 'unknown', transcript };
  }

  // --- Recherche -----------------------------------------------------------
  const searchMatch = text.match(/^(cherche|chercher|trouve|trouver|recherche|rechercher)\s+(.*)$/);
  if (searchMatch) {
    const query = cleanQuery(searchMatch[2]!);
    return query ? { kind: 'search', query } : { kind: 'unknown', transcript };
  }

  // --- Ajout ---------------------------------------------------------------
  // « ajoute » est facultatif : à la caisse, on dit souvent directement
  // « trois bouteilles d'eau ».
  const rest = text.replace(/^(ajoute|ajouter|met|mets|mettre)\s+/, '');
  const restWords = rest.split(' ').filter(Boolean);
  if (restWords.length === 0) return { kind: 'unknown', transcript };

  let index = 0;
  let quantity = 1;
  const parsedQuantity = readNumber(restWords[0]!);
  if (parsedQuantity !== null) {
    quantity = parsedQuantity;
    index = 1;
  }

  let unitWord: string | null = null;
  if (index < restWords.length) {
    const candidate = UNIT_WORDS[restWords[index]!];
    if (candidate) {
      unitWord = candidate;
      index += 1;
    }
  }

  const query = cleanQuery(restWords.slice(index).join(' '));
  if (!query) return { kind: 'unknown', transcript };

  // Sans verbe ni quantité ni unité, la phrase n'est qu'une suite de mots :
  // on la traite comme une recherche plutôt que d'ajouter au panier sur un
  // malentendu.
  if (rest === text && parsedQuantity === null && unitWord === null) {
    return { kind: 'search', query };
  }

  return { kind: 'add', quantity, unitWord, query };
}

function cleanQuery(value: string): string {
  return value
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(' ')
    .trim();
}

function readNumber(word: string): number | null {
  if (/^\d+$/.test(word)) {
    const value = Number.parseInt(word, 10);
    return value > 0 && value <= 999 ? value : null;
  }
  return NUMBER_WORDS[word] ?? null;
}

/**
 * Retrouve l'élément dont le nom colle le mieux aux mots prononcés.
 *
 * Score simple et explicable : chaque mot de la requête présent dans le nom
 * vaut un point, un nom qui contient la requête entière en vaut un de plus.
 * En dessous de la moitié des mots retrouvés, on ne renvoie rien — mieux vaut
 * demander de répéter que d'encaisser le mauvais article.
 */
export function matchByName<T extends { name: string }>(items: T[], query: string): T | null {
  const needleWords = normalize(query).split(' ').filter(Boolean);
  if (needleWords.length === 0) return null;

  let best: { item: T; score: number } | null = null;

  for (const item of items) {
    const haystack = normalize(item.name);
    let score = 0;
    for (const word of needleWords) {
      if (haystack.includes(word)) score += 1;
    }
    if (haystack.includes(needleWords.join(' '))) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }

  if (!best) return null;
  return best.score >= Math.ceil(needleWords.length / 2) ? best.item : null;
}
