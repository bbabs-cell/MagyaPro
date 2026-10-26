'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api, ApiError, uploadFile } from '@/lib/client/api';
import { downscaleImage } from '@/lib/client/downscale-image';

/**
 * Vignette d'aperçu d'un template, avec envoi direct par le Super Admin.
 *
 * Sans envoi, c'est la capture du vrai template, livrée avec le code. Une
 * image envoyée la remplace partout (page vitrine, inscription, apparence) ;
 * « Revenir à la capture » la retire.
 */
export function TemplatePreviewUpload({
  templateKey,
  previewUrl,
  customized,
}: {
  templateKey: string;
  previewUrl: string | null;
  /** Une image envoyée remplace la capture livrée avec le code. */
  customized: boolean;
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
      // Réduite sur l'appareil avant l'envoi, comme les photos des commerçants :
      // un logo de 1,4 Mo était sinon servi tel quel sur chaque page.
      formData.append('file', await downscaleImage(file, 'cover'));
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

  async function reset() {
    setUploading(true);
    setError(null);
    try {
      await api.delete(`/api/admin/template-assets?templateKey=${encodeURIComponent(templateKey)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'aperçu n'a pas pu être rétabli.");
    } finally {
      setUploading(false);
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
        <span aria-hidden="true" className="mb-3 flex h-32 items-center justify-center rounded-lg bg-fg/5 text-xs text-fg/50">
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
        className="inline-flex cursor-pointer items-center rounded-lg border border-fg/15 px-2.5 py-1 text-xs text-fg/70 hover:bg-fg/5"
      >
        {uploading ? 'Envoi…' : previewUrl ? "Remplacer l'aperçu" : 'Ajouter un aperçu'}
      </label>
      {customized && (
        <button
          type="button"
          onClick={() => void reset()}
          disabled={uploading}
          className="ms-2 inline-flex items-center rounded-lg px-2.5 py-1 text-xs text-fg/60 underline-offset-4 hover:underline disabled:opacity-50"
        >
          Revenir à la capture
        </button>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs text-state-bad">{error}</p>}
    </div>
  );
}
