import { describe, expect, it } from 'vitest';

import { isOptimizable, optimizedImageProps, optimizedImageUrl } from '@/lib/optimized-image';

const HOST = 'pub-8df4c147e9cf4373aa253008e73f11cb.r2.dev';
const LOGO = `https://${HOST}/platform/logo.png`;

describe('Images de la plateforme à la bonne taille', () => {
  it('ne passe par l’optimiseur que notre propre stockage', () => {
    expect(isOptimizable(LOGO, HOST)).toBe(true);
    expect(isOptimizable('/uploads/platform/logo.png', HOST)).toBe(true);
    // Hôte étranger, protocole non sécurisé, chemin déjà optimisé ou URL
    // relative au protocole : rendus tels quels, jamais cassés.
    expect(isOptimizable('https://exemple.com/logo.png', HOST)).toBe(false);
    expect(isOptimizable(`http://${HOST}/logo.png`, HOST)).toBe(false);
    expect(isOptimizable('/_next/image?url=x', HOST)).toBe(false);
    expect(isOptimizable(`//${HOST}/logo.png`, HOST)).toBe(false);
    expect(isOptimizable(LOGO, undefined)).toBe(false);
  });

  it('demande une largeur acceptée par Next.js', () => {
    expect(optimizedImageUrl(LOGO, 48, { storageHost: HOST })).toBe(
      `/_next/image?url=${encodeURIComponent(LOGO)}&w=48&q=75`,
    );
    // 50 n'est pas une largeur autorisée : arrondie à la suivante.
    expect(optimizedImageUrl(LOGO, 50, { storageHost: HOST })).toContain('&w=64&');
    expect(optimizedImageUrl(LOGO, 9999, { storageHost: HOST })).toContain('&w=3840&');
  });

  it('propose une version pour les écrans denses', () => {
    const props = optimizedImageProps(LOGO, 384, { storageHost: HOST });
    expect(props.src).toContain('&w=384&');
    expect(props.srcSet).toContain('&w=384&q=75 1x');
    expect(props.srcSet).toContain('&w=828&q=75 2x');
    expect(optimizedImageProps('https://exemple.com/a.png', 384, { storageHost: HOST })).toEqual({
      src: 'https://exemple.com/a.png',
    });
  });
});
