import { Bricolage_Grotesque, DM_Mono, Manrope } from 'next/font/google';

/**
 * Polices de la marque.
 *
 * Deux rôles, deux caractères, choisis pour ce produit précis plutôt que pour
 * leur neutralité :
 *
 * `display` — Bricolage Grotesque. Une grotesque à axe optique variable, dont
 * les formes se resserrent en grand et s'ouvrent en petit. Elle a du caractère
 * sans être décorative, ce qui convient à un outil de travail. Réservée aux
 * titres : employée partout, elle fatiguerait.
 *
 * `mono` — DM Mono. C'est la police du ticket de caisse et du bon de cuisine,
 * les deux seuls objets que ces produits impriment vraiment. Plus chaude qu'une
 * police d'éditeur de code, elle évoque le papier plutôt que le terminal.
 *
 * `sans` — Manrope, demandée par le §6 pour le corps de texte.
 *
 * Le produit était jusqu'ici sur la pile système, et ce choix avait sa
 * logique : zéro octet à télécharger pour le texte le plus volumineux, sur
 * des téléphones à connexion irrégulière. La décision d'adopter Manrope a été
 * prise en connaissance de ce coût — environ trente kilo-octets de plus au
 * premier chargement, et un ressaut du corps de texte pendant que la police
 * arrive.
 *
 * Deux précautions en découlent, plus bas dans ce fichier et dans
 * `globals.css` : le sous-ensemble est réduit au latin, et la pile système
 * reste derrière Manrope plutôt que d'être remplacée — c'est elle qui dessine
 * l'arabe, que Manrope ne couvre pas, et c'est elle qui s'affiche pendant le
 * chargement.
 */

/**
 * Corps de texte.
 *
 * `display: 'swap'` est un choix assumé : le texte est lisible immédiatement
 * dans la police de l'appareil, puis bascule. L'alternative — `optional` —
 * éviterait le ressaut mais laisserait une partie des visiteurs sans Manrope
 * du tout, ce qui viderait la décision de son sens.
 *
 * Sous-ensemble latin seulement. L'arabe n'y figure pas parce que Manrope ne
 * le dessine pas : le navigateur retombe alors glyphe par glyphe sur la pile
 * système, ce qui est exactement le comportement voulu.
 */
export const sansFont = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/** À poser sur `<html>` — expose les trois variables CSS à toute l'application. */
export const fontVariables = `${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`;
