import { Bricolage_Grotesque, DM_Mono } from 'next/font/google';

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
 * Le corps de texte reste sur la pile système définie dans `globals.css` : la
 * remplacer changerait l'application entière, pas seulement les pages de
 * présentation.
 */

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

/** À poser sur `<html>` — expose les deux variables CSS à toute l'application. */
export const fontVariables = `${displayFont.variable} ${monoFont.variable}`;
