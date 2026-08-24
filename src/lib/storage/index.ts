import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { localStorageDriver } from '@/lib/storage/local';
import { s3StorageDriver } from '@/lib/storage/s3';
import type { StorageDriver, StoredFile } from '@/lib/storage/types';

export type { StorageDriver, StoredFile };

/**
 * Couche de stockage des images.
 *
 * L'application ne connaît que l'interface `StorageDriver`. Passer du disque
 * local à un stockage objet (S3, R2, Spaces) se fait en ajoutant un pilote et
 * en changeant `STORAGE_DRIVER` — aucun appelant n'est modifié.
 *
 * Les fichiers ne sont jamais stockés en base : seule leur URL l'est.
 */

const drivers: Record<string, () => StorageDriver> = {
  local: () => localStorageDriver,
  s3: () => s3StorageDriver,
};

let cached: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (cached) return cached;

  const factory = drivers[env.storageDriver];
  if (!factory) {
    throw new Error(
      `Pilote de stockage inconnu : « ${env.storageDriver} ». Pilotes disponibles : ${Object.keys(drivers).join(', ')}.`,
    );
  }
  cached = factory();
  return cached;
}

/** Formats acceptés. La liste est restrictive à dessein. */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Signatures de fichiers (magic numbers).
 *
 * Le `Content-Type` déclaré par le navigateur est une simple affirmation du
 * client. On vérifie les premiers octets pour qu'un script déguisé en `.png`
 * ne soit pas accepté puis servi depuis notre domaine.
 */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // RIFF....WEBP
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  // ....ftypavif
  if (ascii(4, 4) === 'ftyp' && ascii(8, 4).startsWith('avi')) return 'image/avif';

  return null;
}

/**
 * Valide puis enregistre une image téléversée.
 *
 * Le chemin est préfixé par l'identifiant du restaurant : les fichiers sont
 * rangés par tenant, ce qui rend la purge d'un restaurant supprimé triviale.
 */
export async function uploadImage(params: {
  file: File;
  restaurantId: string;
  folder:
    | 'logos'
    | 'covers'
    | 'products'
    | 'categories'
    | 'seo'
    | 'payment-proofs'
    | 'chef'
    | 'subscription-proofs';
}): Promise<StoredFile> {
  const { file, restaurantId, folder } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `L'image ne doit pas dépasser ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as never)) {
    throw new ValidationError(
      'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.',
    );
  }

  const key = `${restaurantId}/${folder}/${crypto.randomUUID()}.${EXTENSIONS[detected]}`;
  return storage().put(key, buffer, detected);
}

/**
 * Vignette d'aperçu d'un template (plateforme, pas un tenant) : clé fixe par
 * template plutôt qu'un nom aléatoire, pour que téléverser une nouvelle
 * image écrase l'ancienne à la même URL — rien d'autre à mettre à jour.
 */
export async function uploadTemplatePreview(params: {
  file: File;
  templateKey: string;
}): Promise<StoredFile> {
  const { file, templateKey } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `L'image ne doit pas dépasser ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as never)) {
    throw new ValidationError(
      'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.',
    );
  }

  // Extension fixe (.jpg) quel que soit le format réel : l'URL reste stable
  // d'un envoi à l'autre. Le navigateur se fie au Content-Type stocké, pas au
  // suffixe du nom de fichier, donc ceci n'affecte pas l'affichage.
  const key = `templates/${templateKey}.jpg`;
  return storage().put(key, buffer, detected);
}

/** URL publique d'une vignette de template, si le pilote de stockage la sert. */
export function templatePreviewUrl(templateKey: string): string | null {
  if (env.storageDriver !== 's3') return null;
  const base = env.s3PublicBaseUrl;
  return base ? `${base}/templates/${templateKey}.jpg` : null;
}

/**
 * Logo de la plateforme (pas d'un tenant) : même logique de clé fixe que les
 * vignettes de template, pour qu'un nouvel envoi écrase l'ancien à la même
 * URL sans rien recâbler ailleurs.
 */
export async function uploadPlatformLogo(params: { file: File }): Promise<StoredFile> {
  const { file } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `L'image ne doit pas dépasser ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as never)) {
    throw new ValidationError(
      'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.',
    );
  }

  const key = 'platform/logo.png';
  return storage().put(key, buffer, detected);
}

/** URL publique du logo de la plateforme, si le pilote de stockage la sert. */
export function platformLogoUrl(): string | null {
  if (env.storageDriver !== 's3') return null;
  const base = env.s3PublicBaseUrl;
  return base ? `${base}/platform/logo.png` : null;
}

/**
 * Illustrations de la section « Comment ça fonctionne » de la page d'accueil
 * (4 étapes) — même logique de clé fixe par étape que le logo de plateforme.
 */
export async function uploadHowItWorksImage(params: {
  file: File;
  step: 1 | 2 | 3 | 4;
}): Promise<StoredFile> {
  const { file, step } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `L'image ne doit pas dépasser ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as never)) {
    throw new ValidationError(
      'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.',
    );
  }

  const key = `platform/how-it-works-${step}.jpg`;
  return storage().put(key, buffer, detected);
}

/** URL publique de l'illustration d'une étape « Comment ça fonctionne ». */
export function howItWorksImageUrl(step: 1 | 2 | 3 | 4): string | null {
  if (env.storageDriver !== 's3') return null;
  const base = env.s3PublicBaseUrl;
  return base ? `${base}/platform/how-it-works-${step}.jpg` : null;
}

/**
 * Logo et image de couverture de la page d'accueil de MagyaPro Boutique
 * (`/boutique`) — asset plateforme distinct du logo Magyapro général
 * (`platform/logo.png`) et de celui d'une boutique individuelle
 * (`Store.logoUrl`, propre à chaque tenant) : même logique de clé fixe.
 */
export async function uploadBoutiqueLandingAsset(params: {
  file: File;
  kind: 'logo' | 'cover';
}): Promise<StoredFile> {
  const { file, kind } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `L'image ne doit pas dépasser ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as never)) {
    throw new ValidationError(
      'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.',
    );
  }

  const key = `platform/boutique-landing-${kind}.jpg`;
  return storage().put(key, buffer, detected);
}

/** URL publique du logo/couverture de la page d'accueil de MagyaPro Boutique. */
export function boutiqueLandingAssetUrl(kind: 'logo' | 'cover'): string | null {
  if (env.storageDriver !== 's3') return null;
  const base = env.s3PublicBaseUrl;
  return base ? `${base}/platform/boutique-landing-${kind}.jpg` : null;
}

/** Formats acceptés pour un son de notification. */
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'] as const;

export const MAX_AUDIO_BYTES = 1 * 1024 * 1024; // 1 Mo — une notification, pas une piste musicale.

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};

/**
 * Signatures de fichiers audio (magic numbers), même logique que pour les
 * images : le `Content-Type` déclaré par le navigateur n'est pas fiable.
 */
function detectAudioType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));

  // MP3 : en-tête ID3, ou synchronisation de trame FF Ex/Fx.
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg';
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'audio/mpeg';
  // WAV : RIFF....WAVE
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'audio/wav';
  // OGG : OggS
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';

  return null;
}

/** Valide puis enregistre un son de notification téléversé. */
export async function uploadNotificationSound(params: {
  file: File;
  restaurantId: string;
}): Promise<StoredFile> {
  const { file, restaurantId } = params;

  if (file.size === 0) {
    throw new ValidationError('Le fichier est vide.');
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new ValidationError(
      `Le son ne doit pas dépasser ${Math.round(MAX_AUDIO_BYTES / 1024)} Ko.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectAudioType(buffer);

  if (!detected || !ALLOWED_AUDIO_TYPES.includes(detected as never)) {
    throw new ValidationError('Format non pris en charge. Utilisez un fichier MP3, WAV ou OGG.');
  }

  const key = `${restaurantId}/sounds/${crypto.randomUUID()}.${AUDIO_EXTENSIONS[detected]}`;
  return storage().put(key, buffer, detected);
}
