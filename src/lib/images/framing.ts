/**
 * Cadrage des photos — quelle partie d'une image survit à l'affichage.
 *
 * Le problème n'est pas théorique. Une même photo de plat est affichée par les
 * sept templates dans des proportions différentes, et toutes utilisent
 * `object-cover`, qui **rogne depuis le centre** :
 *
 * - carré chez « street-food » et sur la grille rapide ;
 * - 4:3 chez « traditional » et sur la fiche du plat ;
 * - de 0,92 à 1,52 chez « bento », selon la largeur de l'écran et selon que la
 *   carte est mise en avant ou non.
 *
 * Autrement dit : le restaurateur téléverse une photo, et **ne voit jamais ce
 * qui en sera coupé**. Une assiette cadrée un peu haut disparaît à moitié sur
 * un template et pas sur un autre.
 *
 * Ce module calcule ce qui reste visible. Il ne fait aucun traitement
 * d'image : c'est de la géométrie, testable sans navigateur ni canvas.
 */

/** Rôle de l'image, qui détermine où elle sera affichée. */
export type ImageRole = 'product' | 'cover' | 'chef' | 'gallery' | 'logo' | 'social';

/**
 * Proportions (largeur / hauteur) auxquelles chaque rôle est réellement
 * affiché sur le site public.
 *
 * Ces valeurs ne sont pas choisies : elles sont relevées dans les templates.
 * Les cellules de « bento » n'ont pas de proportion fixe — la grille impose
 * une hauteur de ligne et une largeur de colonne — leurs deux extrêmes
 * mesurés (mobile deux colonnes, bureau quatre colonnes) encadrent le reste.
 *
 * Si un template change ses proportions, c'est ici qu'il faut le refléter,
 * sinon le guide de cadrage ment.
 */
export const DISPLAY_RATIOS: Record<ImageRole, number[]> = {
  // carré (street-food, grille rapide) · 4:3 (traditional, fiche plat)
  // · bento mobile ≈ 0,92 · bento bureau ≈ 1,52
  product: [0.92, 1, 4 / 3, 1.52],
  // 21:9 (bandeau large) · 4:5 (héros bento en colonne) · carré (bureau)
  cover: [21 / 9, 4 / 5, 1],
  chef: [1],
  gallery: [1],
  logo: [1],
  // Image de partage : 1,91:1 est la proportion attendue par les réseaux et
  // les messageries, qui rognent sans pitié tout ce qui s'en écarte.
  social: [1.91],
};

/**
 * Fraction de l'image source encore visible une fois affichée en
 * `object-cover` dans un cadre d'une autre proportion.
 *
 * `object-cover` remplit le cadre en conservant les proportions : le débord
 * est coupé, à parts égales de chaque côté.
 */
export function visibleFraction(
  sourceRatio: number,
  displayRatio: number,
): { width: number; height: number } {
  if (!(sourceRatio > 0) || !(displayRatio > 0)) return { width: 1, height: 1 };

  if (displayRatio > sourceRatio) {
    // Le cadre est plus large que la source : toute la largeur est utilisée,
    // le haut et le bas sont rognés.
    return { width: 1, height: sourceRatio / displayRatio };
  }
  // Le cadre est plus étroit : toute la hauteur passe, les côtés sont rognés.
  return { width: displayRatio / sourceRatio, height: 1 };
}

/**
 * Zone de l'image visible **dans tous** les affichages d'un rôle — la partie
 * qu'aucun template ne coupe. C'est la seule zone où le sujet est en sécurité.
 *
 * Renvoie des fractions centrées : `{ width: 0.7, height: 0.9 }` signifie que
 * les 70 % centraux en largeur et 90 % en hauteur survivent partout, donc
 * qu'il faut laisser 15 % de marge à gauche et à droite.
 */
export function safeArea(
  sourceRatio: number,
  displayRatios: number[],
): { width: number; height: number } {
  if (displayRatios.length === 0) return { width: 1, height: 1 };

  return displayRatios.reduce(
    (worst, ratio) => {
      const visible = visibleFraction(sourceRatio, ratio);
      return {
        width: Math.min(worst.width, visible.width),
        height: Math.min(worst.height, visible.height),
      };
    },
    { width: 1, height: 1 },
  );
}

/**
 * Proportion de cadrage qui maximise la zone sûre pour un rôle donné.
 *
 * Le pire rognage horizontal vient du cadre le plus étroit, le pire rognage
 * vertical du plus large. La source qui équilibre les deux est la moyenne
 * géométrique des deux extrêmes — pas la moyenne arithmétique : un rapport de
 * proportions se compose en multipliant, pas en additionnant.
 */
export function bestSourceRatio(displayRatios: number[]): number {
  const valid = displayRatios.filter((ratio) => ratio > 0);
  if (valid.length === 0) return 1;
  return Math.sqrt(Math.min(...valid) * Math.max(...valid));
}

/**
 * Proportion de cadrage retenue pour chaque rôle.
 *
 * Elle part de `bestSourceRatio` puis est arrondie à une valeur que l'on peut
 * nommer : un restaurateur comprend « 4:3 », pas « 1,1832 ». L'écart de zone
 * sûre entre les deux est de quelques points de pourcentage — négligeable
 * devant le fait de disposer d'un repère lisible.
 */
export const CAPTURE_RATIOS: Record<ImageRole, { ratio: number; label: string }> = {
  // bestSourceRatio ≈ 1,18 ; 5:4 = 1,25 est le repère nommé le plus proche.
  // Zone sûre : 74 % × 82 %.
  product: { ratio: 5 / 4, label: '5:4' },
  // bestSourceRatio ≈ 1,37 ; 3:2 est le format natif d'un appareil photo et
  // de la plupart des modes « paysage » de téléphone.
  //
  // La zone sûre n'est ici que de 53 % × 64 %, soit un tiers de la surface.
  // Ce n'est pas un défaut du calcul : la couverture est affichée en 21:9 par
  // un template et en 4:5 par un autre, et rien ne peut satisfaire les deux.
  // Voir docs/PHOTOS.md.
  cover: { ratio: 3 / 2, label: '3:2' },
  chef: { ratio: 1, label: '1:1' },
  gallery: { ratio: 1, label: '1:1' },
  logo: { ratio: 1, label: '1:1' },
  social: { ratio: 1.91, label: '191:100' },
};

/**
 * Rectangle de recadrage centré, en pixels, pour amener une image aux
 * proportions voulues sans jamais l'agrandir.
 *
 * On coupe toujours dans la dimension excédentaire : jamais de bande vide,
 * jamais d'étirement.
 */
export function centeredCrop(
  width: number,
  height: number,
  targetRatio: number,
): { x: number; y: number; width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !(targetRatio > 0)) {
    return { x: 0, y: 0, width, height };
  }

  const current = width / height;
  if (Math.abs(current - targetRatio) < 0.001) {
    return { x: 0, y: 0, width, height };
  }

  if (current > targetRatio) {
    // Trop large : on rogne les côtés.
    const cropped = Math.round(height * targetRatio);
    return { x: Math.round((width - cropped) / 2), y: 0, width: cropped, height };
  }

  // Trop haute : on rogne le haut et le bas.
  const cropped = Math.round(width / targetRatio);
  return { x: 0, y: Math.round((height - cropped) / 2), width, height: cropped };
}

/**
 * Décale un rectangle de recadrage selon un point d'intérêt, en le maintenant
 * à l'intérieur de l'image.
 *
 * `focus` va de 0 à 1 sur chaque axe ; 0,5 correspond au centre, donc au
 * comportement de `centeredCrop`. Sert au réglage manuel : le restaurateur
 * déplace le cadre pour que son assiette soit dedans.
 */
export function focusedCrop(
  width: number,
  height: number,
  targetRatio: number,
  focus: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const crop = centeredCrop(width, height, targetRatio);
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

  return {
    ...crop,
    x: clamp(focus.x * width - crop.width / 2, width - crop.width),
    y: clamp(focus.y * height - crop.height / 2, height - crop.height),
  };
}

/** Zone sûre d'un rôle, en pourcentages entiers, pour l'affichage à l'écran. */
export function safeAreaPercent(role: ImageRole): { width: number; height: number } {
  const area = safeArea(CAPTURE_RATIOS[role].ratio, DISPLAY_RATIOS[role]);
  return {
    width: Math.round(area.width * 100),
    height: Math.round(area.height * 100),
  };
}
