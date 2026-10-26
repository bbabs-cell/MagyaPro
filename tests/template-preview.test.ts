import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { templatePreviewUrl } from '@/lib/storage';
import { TEMPLATES } from '@/lib/templates/registry';

describe('Aperçu des templates', () => {
  it('montre la capture livrée avec le code', () => {
    expect(templatePreviewUrl('modern')).toBe('/templates/modern.webp');
    expect(templatePreviewUrl('prestige', null)).toBe('/templates/prestige.webp');
  });

  it('préfère l’image envoyée par le Super Admin', () => {
    const uploaded = 'https://stockage.exemple/templates/modern.jpg?v=1';
    expect(templatePreviewUrl('modern', uploaded)).toBe(uploaded);
  });

  it('n’invente pas d’aperçu pour un template inconnu', () => {
    expect(templatePreviewUrl('inconnu')).toBeNull();
  });

  it('a une capture pour chaque template du registre', () => {
    for (const template of TEMPLATES) {
      expect(existsSync(`public/templates/${template.key}.webp`), template.key).toBe(true);
    }
  });
});
