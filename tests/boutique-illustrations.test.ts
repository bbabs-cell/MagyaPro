import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BOUTIQUE_SECTORS, boutiqueHowItWorksImageUrl, boutiqueSectorImageUrl } from '@/lib/storage';

/** Une adresse `/…` de la page renvoie à un fichier de `public/`. */
const publicFile = (url: string) => `public${url}`;

describe('Illustrations de la page Boutique', () => {
  it('a une capture pour chaque étape « Comment ça fonctionne »', () => {
    for (const step of [1, 2, 3, 4] as const) {
      expect(existsSync(publicFile(boutiqueHowItWorksImageUrl(step))), `étape ${step}`).toBe(true);
    }
  });

  it('a une image pour chaque secteur affiché', () => {
    for (const sector of BOUTIQUE_SECTORS) {
      expect(existsSync(publicFile(boutiqueSectorImageUrl(sector))), sector).toBe(true);
    }
  });
});
