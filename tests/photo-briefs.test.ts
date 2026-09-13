import { describe, expect, it } from 'vitest';

import { photoBrief } from '@/lib/images/briefs';
import { DISPLAY_RATIOS, safeAreaPercent, type ImageRole } from '@/lib/images/framing';

const ROLES = Object.keys(DISPLAY_RATIOS) as ImageRole[];

describe('Briefs de prise de vue', () => {
  it('existe pour chaque rôle d\'image', () => {
    for (const role of ROLES) {
      const brief = photoBrief(role);
      expect(brief.intent.length).toBeGreaterThan(0);
      expect(brief.tips.length).toBeGreaterThan(0);
      expect(brief.avoid.length).toBeGreaterThan(0);
      expect(brief.framing.length).toBeGreaterThan(0);
    }
  });

  it('ne contient aucune consigne vide ni dupliquée', () => {
    for (const role of ROLES) {
      const brief = photoBrief(role);
      for (const line of [...brief.tips, ...brief.avoid]) {
        expect(line.trim()).toBe(line);
        expect(line.length).toBeGreaterThan(10);
      }
      expect(new Set(brief.tips).size).toBe(brief.tips.length);
      expect(new Set(brief.avoid).size).toBe(brief.avoid.length);
    }
  });

  it('reste court : le brief est lu au moment du téléversement, pas étudié', () => {
    for (const role of ROLES) {
      const brief = photoBrief(role);
      expect(brief.tips.length).toBeLessThanOrEqual(4);
      expect(brief.avoid.length).toBeLessThanOrEqual(3);
    }
  });

  it('annonce les pourcentages réellement calculés, pas des chiffres rédigés', () => {
    // C'est la garantie que la consigne suit les templates : si un template
    // change ses proportions, la phrase change avec lui.
    const role: ImageRole = 'product';
    const safe = safeAreaPercent(role);
    const brief = photoBrief(role);
    expect(brief.framing).toContain(`${safe.width} %`);
    expect(brief.framing).toContain(`${safe.height} %`);
  });

  it('ne parle pas de rognage quand il n\'y en a pas', () => {
    // Un rôle affiché à une seule proportion, cadré à cette proportion, ne
    // perd rien : lui annoncer une zone sûre serait faux.
    const brief = photoBrief('gallery');
    expect(brief.framing).toContain('entière');
    expect(brief.framing).not.toContain('%');
  });

  it('mentionne le repère de cadrage dans chaque brief', () => {
    for (const role of ROLES) {
      expect(photoBrief(role).framing).toMatch(/Cadrage \d+:\d+\./);
    }
  });
});
