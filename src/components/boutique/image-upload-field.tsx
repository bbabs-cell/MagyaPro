'use client';

import { useRef, useState } from 'react';

import { ApiError, uploadFile } from '@/lib/client/api';
import { Button } from '@/components/ui';

/**
 * Champ de téléversement d'image pour une boutique — équivalent de
 * `ImageUploadField` (Restaurant), pointant vers `/api/boutique/upload`.
 */
export function ImageUploadField({
  label,
  folder,
  value,
  hint,
  onChange,
}: {
  label: string;
  folder: 'logos' | 'covers';
  value: string | null;
  hint?: string;
  onChange: (url: string | null) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const result = await uploadFile<{ url: string }>('/api/boutique/upload', formData);
      await onChange(result.url);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "L'image n'a pas pu être envoyée. Réessayez.",
      );
    } finally {
      setUploading(false);
      // Réinitialiser permet de re-sélectionner le même fichier après une erreur.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const inputId = `boutique-upload-${folder}-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}

      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- image téléversée par le tenant
          <img
            src={value}
            alt=""
            className="h-16 w-16 rounded-xl border border-surface-border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-surface-border text-xs text-ink-faint"
          >
            Vide
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Envoi…' : value ? 'Remplacer' : 'Choisir une image'}
          </Button>

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => void onChange(null)}
            >
              Retirer
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
