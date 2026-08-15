'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, uploadFile } from '@/lib/client/api';

/**
 * Envoi de l'illustration d'une étape « Comment ça fonctionne » par le Super
 * Admin. Clé de stockage fixe par étape : un nouvel envoi écrase l'ancien à
 * la même URL, donc `router.refresh()` suffit à le faire réapparaître sur la
 * page d'accueil sans rien recâbler.
 */
export function HowItWorksUpload({
  step,
  title,
  imageUrl,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('step', String(step));
      await uploadFile('/api/admin/how-it-works-assets', formData);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'image n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- illustration de plateforme, hôte de stockage arbitraire
        <img
          src={`${imageUrl}?t=${Date.now()}`}
          alt=""
          className="mb-3 h-28 w-full rounded-lg object-cover"
        />
      ) : (
        <span aria-hidden="true" className="mb-3 flex h-28 items-center justify-center rounded-lg bg-white/5 text-xs text-white/30">
          Aucune image
        </span>
      )}

      <p className="mb-2 text-xs font-medium text-white/70">
        Étape {step} — {title}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        id={`how-it-works-upload-${step}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <label
        htmlFor={`how-it-works-upload-${step}`}
        className="inline-flex cursor-pointer items-center rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/5"
      >
        {uploading ? 'Envoi…' : imageUrl ? "Remplacer l'image" : 'Ajouter une image'}
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
