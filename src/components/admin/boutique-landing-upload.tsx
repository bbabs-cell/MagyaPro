'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, uploadFile } from '@/lib/client/api';
import { downscaleImage } from '@/lib/client/downscale-image';

/**
 * Envoi du logo de la page d'accueil de MagyaPro Boutique (`/boutique`) —
 * même logique de clé fixe que `PlatformLogoUpload` : un nouvel envoi
 * écrase l'ancien à la même URL.
 */
export function BoutiqueLandingUpload({ imageUrl }: { imageUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      // Réduite sur l'appareil avant l'envoi, comme les photos des commerçants :
      // un logo de 1,4 Mo était sinon servi tel quel sur chaque page.
      formData.append('file', await downscaleImage(file, 'logo'));
      await uploadFile('/api/admin/boutique-landing-assets', formData);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'image n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-4">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- asset de plateforme, hôte de stockage arbitraire
        <img
          src={`${imageUrl}?t=${Date.now()}`}
          alt=""
          className="h-16 w-16 rounded-xl border border-fg/15 bg-fg/5 object-contain p-1.5"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-fg/20 text-xs text-fg/60"
        >
          Aucun logo
        </span>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          id="boutique-landing-logo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <label
          htmlFor="boutique-landing-logo"
          className="inline-flex cursor-pointer items-center rounded-lg border border-fg/15 px-3 py-1.5 text-xs text-fg/70 hover:bg-fg/5"
        >
          {uploading ? 'Envoi…' : imageUrl ? 'Remplacer le logo' : 'Envoyer le logo'}
        </label>
        {error && <p role="alert" className="mt-1.5 text-xs text-state-bad">{error}</p>}
      </div>
    </div>
  );
}
