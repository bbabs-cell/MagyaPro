'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, uploadFile } from '@/lib/client/api';

/**
 * Vignette d'aperçu d'un template, avec envoi direct par le Super Admin.
 *
 * La clé de stockage est fixe par template (`templates/<key>.jpg`) : envoyer
 * une nouvelle image écrase l'ancienne à la même URL, donc un simple
 * `router.refresh()` suffit à la faire réapparaître partout où elle est
 * affichée (apparence, onboarding, admin) sans rien recâbler.
 */
export function TemplatePreviewUpload({
  templateKey,
  previewUrl,
}: {
  templateKey: string;
  previewUrl: string | null;
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
      formData.append('templateKey', templateKey);
      await uploadFile('/api/admin/template-assets', formData);
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
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu de template, hôte de stockage arbitraire
        <img
          src={previewUrl}
          alt=""
          className="mb-3 h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <span aria-hidden="true" className="mb-3 flex h-32 items-center justify-center rounded-lg bg-white/5 text-xs text-white/30">
          Aucun aperçu
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        id={`template-preview-${templateKey}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <label
        htmlFor={`template-preview-${templateKey}`}
        className="inline-flex cursor-pointer items-center rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/5"
      >
        {uploading ? 'Envoi…' : previewUrl ? "Remplacer l'aperçu" : 'Ajouter un aperçu'}
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
