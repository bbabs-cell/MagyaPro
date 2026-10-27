import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DEMO_STORE_SLUGS } from '@/lib/boutique/demo-seed';
import {
  BOUTIQUE_SECTORS,
  boutiqueDemoImageUrl,
  boutiqueHowItWorksImageUrl,
  boutiqueSectorImageUrl,
  howItWorksImageUrl,
} from '@/lib/storage';

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

  it('a une capture de caisse pour chaque vitrine', () => {
    for (const slug of DEMO_STORE_SLUGS) {
      const url = boutiqueDemoImageUrl(slug);
      expect(url, `${slug} absente de BOUTIQUE_DEMO_CAPTURES`).not.toBeNull();
      expect(existsSync(publicFile(url!)), slug).toBe(true);
    }
  });

  it('a les trois appareils du héros', () => {
    for (const device of ['ordinateur', 'tablette', 'telephone']) {
      expect(existsSync(`public/marketing/boutique/hero-${device}.webp`), device).toBe(true);
    }
  });

  it('ne promet pas de capture à une boutique qui n’est pas une vitrine', () => {
    expect(boutiqueDemoImageUrl('ma-boutique')).toBeNull();
  });
});

describe('Illustrations de la page Restaurant', () => {
  it('a une capture pour chaque étape « Comment ça fonctionne »', () => {
    for (const step of [1, 2, 3, 4] as const) {
      expect(existsSync(publicFile(howItWorksImageUrl(step))), `étape ${step}`).toBe(true);
    }
  });
});
