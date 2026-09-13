/**
 * Briefs de prise de vue.
 *
 * Le §21 demande une direction photographique. Elle ne peut pas prendre la
 * forme d'images fournies : ce sont les plats du restaurateur qu'il faut
 * montrer, pas des photos de synthèse ni des photos de banque — un client qui
 * commande d'après une image qui ne correspond à rien reçoit autre chose que
 * ce qu'il a vu.
 *
 * Elle prend donc la forme de consignes, affichées **à l'endroit et au moment
 * où la photo est choisie**. Un document séparé ne serait pas lu.
 *
 * Les consignes tiennent en quatre lignes par rôle, à l'impératif, sans
 * vocabulaire de photographe. Elles ne décrivent que ce qui se décide au
 * moment de la prise de vue — le reste (poids, dimensions, recadrage) est
 * fait par le produit et n'a pas à être demandé à l'utilisateur.
 */

import { CAPTURE_RATIOS, safeAreaPercent, type ImageRole } from '@/lib/images/framing';

export type PhotoBrief = {
  /** Ce que la photo doit montrer, en une phrase. */
  intent: string;
  /** Les consignes de prise de vue, dans l'ordre où elles se décident. */
  tips: string[];
  /** Les erreurs les plus fréquentes, formulées comme telles. */
  avoid: string[];
};

const BRIEFS: Record<ImageRole, PhotoBrief> = {
  product: {
    intent: "Donner envie de ce plat précis, tel qu'il sera servi.",
    tips: [
      'Près d’une fenêtre, en journée, sans allumer le plafonnier.',
      'Assiette au centre, vue de trois quarts plutôt qu’à la verticale.',
      'Fond uni : une table en bois, une nappe claire, un plateau.',
      'Le plat tel qu’il part en salle — même portion, même dressage.',
    ],
    avoid: [
      'Le flash direct, qui écrase le relief et jaunit la sauce.',
      'Une assiette collée au bord du cadre : les côtés sont rognés.',
      'Un plat refroidi ou entamé.',
    ],
  },
  cover: {
    intent: 'Montrer la salle ou la devanture, pas un plat.',
    tips: [
      'En largeur, jamais en hauteur.',
      'Le sujet au centre : cette image est recadrée très différemment selon les écrans.',
      'En fin de journée si la salle donne sur la rue, la lumière est plus douce.',
      'Salle rangée, tables dressées, sans personnel de dos.',
    ],
    avoid: [
      'Une photo de plat en couverture : elle est déjà sur la carte.',
      'Du texte incrusté dans l’image : il sera coupé.',
      'Une salle vide et éclairée au néon.',
    ],
  },
  chef: {
    intent: 'Mettre un visage sur la cuisine.',
    tips: [
      'Buste, regard vers l’objectif, en cuisine ou en salle.',
      'Lumière naturelle de côté plutôt que de face.',
      'Tenue de travail propre.',
    ],
    avoid: ['Une photo de groupe : le cadre est carré et serré.', 'Un contre-jour devant une fenêtre.'],
  },
  gallery: {
    intent: 'Faire sentir l’ambiance : la salle, les gestes, les détails.',
    tips: [
      'Variez les échelles : une vue large, un plan de travail, un détail.',
      'Gardez une lumière cohérente entre les photos d’une même série.',
      'Le sujet au centre : la galerie affiche en carré.',
    ],
    avoid: ['Dix photos du même angle.', 'Des clients reconnaissables sans leur accord.'],
  },
  social: {
    intent: "Ce qui s'affiche quand un client partage votre lien sur WhatsApp.",
    tips: [
      'Une vue large : la salle, la devanture, ou un plat signature.',
      'Le sujet au centre et grand — la vignette est petite sur un téléphone.',
      'De la couleur : cette image apparaît dans un fil de discussion.',
    ],
    avoid: [
      'Votre logo seul : il se perd dans une bande très large.',
      'Une image sombre, illisible en aperçu.',
    ],
  },
  logo: {
    intent: 'Identifier le commerce sur fond clair comme sur fond sombre.',
    tips: [
      'Un fichier PNG à fond transparent si vous en avez un.',
      'Le logo seul, sans slogan ni cadre autour.',
    ],
    avoid: ['Une photo d’enseigne prise de travers.', 'Un logo sur fond blanc collé dans un carré.'],
  },
};

/**
 * Brief complet d'un rôle, consignes de cadrage comprises.
 *
 * La ligne sur la zone sûre est **calculée**, pas rédigée : elle découle des
 * proportions réellement imposées par les templates. Si un template change,
 * la consigne change avec lui plutôt que de devenir fausse en silence.
 */
export function photoBrief(role: ImageRole): PhotoBrief & { framing: string } {
  const brief = BRIEFS[role];
  const safe = safeAreaPercent(role);
  const { label } = CAPTURE_RATIOS[role];

  const tightest = Math.min(safe.width, safe.height);
  const framing =
    tightest >= 95
      ? `Cadrage ${label}. Cette image est affichée entière, sans rognage.`
      : `Cadrage ${label}. Selon le modèle de site et la taille de l’écran, seuls les ` +
        `${safe.width} % centraux en largeur et ${safe.height} % en hauteur sont visibles partout : ` +
        `gardez le sujet dans le cadre en pointillés.`;

  return { ...brief, framing };
}
