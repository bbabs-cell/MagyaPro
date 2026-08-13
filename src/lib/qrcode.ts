import QRCode from 'qrcode';

/**
 * Génération de QR codes, entièrement locale.
 *
 * Pas d'appel à un service tiers pour convertir un lien en image : la
 * bibliothèque dessine le code elle-même, ce qui fonctionne aussi bien en
 * développement que derrière un pare-feu strict en production.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 320 });
}
