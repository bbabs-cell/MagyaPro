import { describe, expect, it } from 'vitest';

import { IMAGE_TARGETS, targetSize } from '@/lib/client/downscale-image';

/**
 * Calcul des dimensions de sortie avant envoi d'une image.
 *
 * La partie qui dessine dépend du navigateur et n'est pas testable ici ; le
 * calcul, lui, décide de ce que verront les visiteurs d'un site de restaurant
 * et de ce que pèsera leur forfait.
 */

describe('Dimensions de sortie', () => {
  it('réduit le plus grand côté à la cible, à proportions gardées', () => {
    // Photo de téléphone typique, en paysage.
    expect(targetSize(4032, 3024, IMAGE_TARGETS.cover)).toEqual({
      width: 1600,
      height: 1200,
      scaled: true,
    });
  });

  it('traite le portrait comme le paysage', () => {
    expect(targetSize(3024, 4032, IMAGE_TARGETS.cover)).toEqual({
      width: 1200,
      height: 1600,
      scaled: true,
    });
  });

  it('n’agrandit jamais une image déjà petite', () => {
    // L'étirer n'ajoute aucun détail et ne ferait que gonfler le fichier.
    expect(targetSize(400, 300, IMAGE_TARGETS.cover)).toEqual({
      width: 400,
      height: 300,
      scaled: false,
    });
  });

  it('laisse intacte une image exactement à la cible', () => {
    expect(targetSize(1600, 900, IMAGE_TARGETS.cover).scaled).toBe(false);
  });

  it('ne rend jamais une dimension nulle sur une image très allongée', () => {
    // Une bannière de 5000 x 3 pixels : la hauteur arrondie tomberait à zéro,
    // et un canvas de hauteur nulle ne dessine rien.
    const size = targetSize(5000, 3, IMAGE_TARGETS.cover);
    expect(size.width).toBe(1600);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it('supporte une image de dimensions inconnues sans planter', () => {
    expect(targetSize(0, 0, IMAGE_TARGETS.cover)).toEqual({ width: 0, height: 0, scaled: false });
  });

  it('applique une cible plus basse aux logos qu’aux couvertures', () => {
    expect(IMAGE_TARGETS.logo).toBeLessThan(IMAGE_TARGETS.product);
    expect(IMAGE_TARGETS.product).toBeLessThan(IMAGE_TARGETS.cover);
  });
});
