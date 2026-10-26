import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { boutiqueHowItWorksImageUrl } from '@/lib/storage';

/** Une adresse `/…` de la page renvoie à un fichier de `public/`. */
const publicFile = (url: string) => `public${url}`;

describe('Illustrations de la page Boutique', () => {
  it('a une capture pour chaque étape « Comment ça fonctionne »', () => {
    for (const step of [1, 2, 3, 4] as const) {
      expect(existsSync(publicFile(boutiqueHowItWorksImageUrl(step))), `étape ${step}`).toBe(true);
    }
  });

});
