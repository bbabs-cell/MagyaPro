/**
 * Recadrage d'une image dans le navigateur, avant envoi.
 *
 * Complète `downscale-image.ts` : celui-ci réduit le poids, celui-là décide
 * de ce qui reste dans le cadre. Les deux s'appuient sur le canvas du
 * navigateur — aucune bibliothèque, aucun service, aucun coût à l'usage.
 *
 * Le recadrage se fait **avant** la réduction pour ne pas ré-encoder deux
 * fois : on dessine la zone retenue directement à la taille finale.
 */

import { IMAGE_TARGETS, targetSize, type ImageTarget } from '@/lib/client/downscale-image';
import { focusedCrop } from '@/lib/images/framing';

const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp']);

function encodesWebp(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('decode'));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dimensions réelles d'un fichier image, ou `null` si le navigateur refuse. */
export async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!RASTER.has(file.type)) return null;
  try {
    const { source, width, height } = await decode(file);
    if ('close' in source && typeof source.close === 'function') source.close();
    return { width, height };
  } catch {
    return null;
  }
}

/**
 * Recadre puis réduit, en une seule passe.
 *
 * Comme `downscaleImage`, **n'échoue jamais** : si le navigateur ne sait pas
 * décoder le fichier, il part tel quel. Un envoi non recadré vaut mieux qu'un
 * envoi impossible.
 */
export async function cropAndDownscale(
  file: File,
  target: ImageTarget,
  targetRatio: number,
  focus: { x: number; y: number },
): Promise<File> {
  if (!RASTER.has(file.type)) return file;

  try {
    const { source, width, height } = await decode(file);
    const crop = focusedCrop(width, height, targetRatio, focus);

    // La zone retenue est ensuite ramenée sous la taille maximale du rôle.
    const size = targetSize(crop.width, crop.height, IMAGE_TARGETS[target]);

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    );
    if ('close' in source && typeof source.close === 'function') source.close();

    const type = encodesWebp() ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, 0.82);
    });
    if (!blob) return file;

    const extension = type === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}.${extension}`, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
