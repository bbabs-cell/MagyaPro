import {
  DM_Sans,
  Inter,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from 'next/font/google';

/**
 * Polices proposées aux restaurants pour leur vitrine.
 *
 * Elles étaient chargées depuis `fonts.googleapis.com` par une balise `<link>`
 * — et **la politique de sécurité du contenu bloquait cette feuille de style**.
 * `style-src` n'autorise que le domaine du site ; la requête était refusée par
 * le navigateur, silencieusement.
 *
 * Conséquence : le restaurateur choisissait sa police dans son tableau de
 * bord, l'enregistrait, et rien ne changeait sur son site. Les trois modèles
 * qui reposent sur un contraste serif/sans perdaient ce contraste entièrement.
 *
 * Deux issues possibles : ouvrir la politique de sécurité à Google, ou héberger
 * les polices avec le reste de l'application. La seconde est retenue, pour les
 * mêmes raisons que Manrope en phase 17 — aucune requête de visiteur vers un
 * tiers, donc aucune adresse IP transmise ailleurs — et parce qu'elle ne
 * relâche aucune règle de sécurité.
 *
 * `preload: false` partout : une vitrine n'utilise qu'une police de corps de
 * texte à la fois, et précharger les cinq gaspillerait la bande passante que
 * ce produit s'attache justement à économiser. Le navigateur ne télécharge que
 * le fichier dont il a réellement besoin.
 */

const inter = Inter({ subsets: ['latin'], variable: '--site-font-inter', display: 'swap', preload: false });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--site-font-poppins',
  display: 'swap',
  preload: false,
});
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--site-font-dm-sans', display: 'swap', preload: false });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--site-font-space-grotesk',
  display: 'swap',
  preload: false,
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--site-font-playfair',
  display: 'swap',
  preload: false,
});

/** Nom de la police tel qu'enregistré par le restaurant → sa pile CSS. */
export const SITE_FONT_STACKS: Record<string, string> = {
  Inter: `var(--site-font-inter), ui-sans-serif, system-ui, sans-serif`,
  Poppins: `var(--site-font-poppins), ui-sans-serif, system-ui, sans-serif`,
  'DM Sans': `var(--site-font-dm-sans), ui-sans-serif, system-ui, sans-serif`,
  'Space Grotesk': `var(--site-font-space-grotesk), ui-sans-serif, system-ui, sans-serif`,
  'Playfair Display': `var(--site-font-playfair), ui-serif, Georgia, serif`,
};

/** Pile de la police choisie, ou celle par défaut si le nom est inconnu. */
export function siteFontStack(name: string | null | undefined): string {
  return SITE_FONT_STACKS[name ?? ''] ?? SITE_FONT_STACKS.Inter!;
}

/**
 * Classes à poser sur l'enveloppe de la vitrine : elles déclarent les cinq
 * variables CSS. Déclarer n'est pas télécharger — seul le fichier de la police
 * effectivement appliquée est demandé par le navigateur.
 */
export const siteFontVariables = [
  inter.variable,
  poppins.variable,
  dmSans.variable,
  spaceGrotesk.variable,
  playfair.variable,
].join(' ');
