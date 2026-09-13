import { describe, expect, it } from 'vitest';

import {
  CAPTURE_RATIOS,
  DISPLAY_RATIOS,
  bestSourceRatio,
  centeredCrop,
  focusedCrop,
  safeArea,
  safeAreaPercent,
  visibleFraction,
  type ImageRole,
} from '@/lib/images/framing';

const ROLES = Object.keys(DISPLAY_RATIOS) as ImageRole[];

describe('Fraction visible après object-cover', () => {
  it('ne coupe rien quand le cadre a les proportions de la source', () => {
    expect(visibleFraction(1.5, 1.5)).toEqual({ width: 1, height: 1 });
    expect(visibleFraction(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it('rogne le haut et le bas quand le cadre est plus large', () => {
    // Source carrée dans un cadre 2:1 : la moitié de la hauteur disparaît.
    expect(visibleFraction(1, 2)).toEqual({ width: 1, height: 0.5 });
  });

  it('rogne les côtés quand le cadre est plus étroit', () => {
    // Source 2:1 dans un cadre carré : la moitié de la largeur disparaît.
    expect(visibleFraction(2, 1)).toEqual({ width: 0.5, height: 1 });
  });

  it('ne rogne jamais les deux dimensions à la fois', () => {
    // C'est la propriété qui définit `object-cover` : il remplit le cadre.
    for (let source = 0.4; source <= 3; source += 0.1) {
      for (let display = 0.4; display <= 3; display += 0.1) {
        const visible = visibleFraction(source, display);
        expect(Math.max(visible.width, visible.height)).toBeCloseTo(1, 10);
      }
    }
  });

  it('ne renvoie jamais de fraction hors de ]0, 1]', () => {
    for (let source = 0.2; source <= 5; source += 0.2) {
      for (let display = 0.2; display <= 5; display += 0.2) {
        const visible = visibleFraction(source, display);
        for (const value of [visible.width, visible.height]) {
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('reste sur une image entière face à une valeur absurde', () => {
    expect(visibleFraction(0, 1)).toEqual({ width: 1, height: 1 });
    expect(visibleFraction(1, -3)).toEqual({ width: 1, height: 1 });
    expect(visibleFraction(Number.NaN, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('Zone sûre', () => {
  it('retient le pire rognage de chaque axe, pas le dernier', () => {
    // 2:1 coupe la largeur, 1:2 coupe la hauteur : la zone sûre cumule les deux.
    expect(safeArea(1, [2, 0.5])).toEqual({ width: 0.5, height: 0.5 });
  });

  it("vaut l'image entière quand un seul affichage existe et qu'il correspond", () => {
    expect(safeArea(1, [1])).toEqual({ width: 1, height: 1 });
  });

  it('vaut l\'image entière quand aucun affichage n\'est déclaré', () => {
    expect(safeArea(1.5, [])).toEqual({ width: 1, height: 1 });
  });

  it('est maximisée par bestSourceRatio', () => {
    // C'est la raison d'être de la fonction : aucune autre proportion ne doit
    // faire mieux, sur aucun des deux axes simultanément.
    for (const role of ROLES) {
      const ratios = DISPLAY_RATIOS[role];
      const best = safeArea(bestSourceRatio(ratios), ratios);
      const bestMin = Math.min(best.width, best.height);

      for (let candidate = 0.3; candidate <= 3; candidate += 0.05) {
        const area = safeArea(candidate, ratios);
        expect(Math.min(area.width, area.height)).toBeLessThanOrEqual(bestMin + 1e-9);
      }
    }
  });

  it('équilibre les deux axes au ratio optimal', () => {
    for (const role of ROLES) {
      const ratios = DISPLAY_RATIOS[role];
      const area = safeArea(bestSourceRatio(ratios), ratios);
      expect(area.width).toBeCloseTo(area.height, 10);
    }
  });
});

describe('Ratios de prise de vue', () => {
  it('couvre chaque rôle déclaré', () => {
    for (const role of ROLES) {
      expect(CAPTURE_RATIOS[role]).toBeDefined();
      expect(CAPTURE_RATIOS[role]!.ratio).toBeGreaterThan(0);
      expect(CAPTURE_RATIOS[role]!.label).toMatch(/^\d+:\d+$/);
    }
  });

  it('reste proche du ratio optimal de son rôle', () => {
    // L'arrondi vers un repère nommable est volontaire, mais il ne doit pas
    // dériver : au-delà de 20 % d'écart, le repère ne décrit plus la réalité.
    for (const role of ROLES) {
      const best = bestSourceRatio(DISPLAY_RATIOS[role]);
      const chosen = CAPTURE_RATIOS[role]!.ratio;
      expect(Math.abs(chosen - best) / best).toBeLessThan(0.2);
    }
  });

  it('laisse une zone sûre exploitable pour les photos de plat', () => {
    // Le plat est le cas qui compte : c'est la photo que le restaurateur
    // reprend le plus souvent. En dessous de 70 %, le guide serait inutilisable.
    const area = safeAreaPercent('product');
    expect(area.width).toBeGreaterThanOrEqual(70);
    expect(area.height).toBeGreaterThanOrEqual(70);
  });

  it('signale que la couverture est le rôle le plus contraint', () => {
    // Documenté comme un compromis assumé dans docs/PHOTOS.md : si ce test
    // casse, c'est que les proportions des templates ont changé et que la
    // documentation doit suivre.
    const cover = safeAreaPercent('cover');
    expect(cover.width).toBeLessThan(safeAreaPercent('product').width);
  });
});

describe('Recadrage centré', () => {
  it('ne touche pas une image déjà aux bonnes proportions', () => {
    expect(centeredCrop(1000, 800, 1.25)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('rogne les côtés d\'une image trop large', () => {
    expect(centeredCrop(2000, 1000, 1)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('rogne le haut et le bas d\'une image trop haute', () => {
    expect(centeredCrop(1000, 2000, 1)).toEqual({ x: 0, y: 500, width: 1000, height: 1000 });
  });

  it('reste dans les bornes de l\'image, quelles que soient les proportions', () => {
    for (const [width, height] of [[4032, 3024], [1080, 1920], [800, 800], [3, 5000]]) {
      for (const ratio of [1, 4 / 3, 5 / 4, 3 / 2, 21 / 9, 4 / 5]) {
        const crop = centeredCrop(width!, height!, ratio);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.width).toBeGreaterThan(0);
        expect(crop.height).toBeGreaterThan(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(width!);
        expect(crop.y + crop.height).toBeLessThanOrEqual(height!);
      }
    }
  });

  it('n\'agrandit jamais', () => {
    const crop = centeredCrop(1000, 800, 3);
    expect(crop.width).toBeLessThanOrEqual(1000);
    expect(crop.height).toBeLessThanOrEqual(800);
  });

  it('rend l\'image intacte face à une dimension absurde', () => {
    expect(centeredCrop(0, 500, 1)).toEqual({ x: 0, y: 0, width: 0, height: 500 });
  });
});

describe('Recadrage avec point d\'intérêt', () => {
  it('équivaut au recadrage centré quand le point est au centre', () => {
    expect(focusedCrop(2000, 1000, 1, { x: 0.5, y: 0.5 })).toEqual(centeredCrop(2000, 1000, 1));
  });

  it('suit le point d\'intérêt', () => {
    const left = focusedCrop(2000, 1000, 1, { x: 0.25, y: 0.5 });
    const right = focusedCrop(2000, 1000, 1, { x: 0.75, y: 0.5 });
    expect(left.x).toBeLessThan(right.x);
  });

  it('ne sort jamais de l\'image, même pour un point aux bords ou hors bornes', () => {
    for (const x of [-1, 0, 0.5, 1, 2]) {
      for (const y of [-1, 0, 0.5, 1, 2]) {
        const crop = focusedCrop(1200, 1600, 5 / 4, { x, y });
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(1200);
        expect(crop.y + crop.height).toBeLessThanOrEqual(1600);
      }
    }
  });

  it('conserve les dimensions du recadrage centré', () => {
    const centered = centeredCrop(1200, 1600, 5 / 4);
    const focused = focusedCrop(1200, 1600, 5 / 4, { x: 0.1, y: 0.9 });
    expect(focused.width).toBe(centered.width);
    expect(focused.height).toBe(centered.height);
  });
});
