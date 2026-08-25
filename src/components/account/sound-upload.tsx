'use client';

import { useRef, useState } from 'react';

import { ApiError, api, uploadFile } from '@/lib/client/api';
import { Button } from '@/components/ui';

/**
 * Son de notification personnalisé — Core, partagé entre Restaurant et
 * Boutique (`/api/restaurant/notification-sound`,
 * `/api/boutique/notification-sound`, même comportement des deux côtés).
 *
 * Le fichier part vers `endpoint`, qui le valide, le range et l'enregistre
 * directement sur les réglages du tenant — pas besoin de cliquer sur
 * « Enregistrer » séparément, un envoi = un réglage appliqué.
 */
export function SoundUploadField({
  endpoint,
  value,
  onChange,
}: {
  endpoint: string;
  value: string | null;
  onChange: (url: string | null) => void;
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
      const result = await uploadFile<{ url: string }>(
        endpoint,
        formData,
      );
      onChange(result.url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Le son n'a pas pu être envoyé. Réessayez.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError(null);
    try {
      await api.delete(endpoint);
      onChange(null);
    } catch {
      setError("La suppression a échoué. Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink">Son de notification</label>
      <p className="text-xs text-ink-muted">
        Joué dès qu&apos;une nouvelle commande arrive. MP3, WAV ou OGG, 1 Mo maximum. Sans
        fichier, un bip par défaut est utilisé.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <audio controls src={value} className="h-10 max-w-full" />
        )}

        <input
          ref={inputRef}
          id="notification-sound-upload"
          type="file"
          accept="audio/mpeg,audio/wav,audio/ogg"
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
          {uploading ? 'Envoi…' : value ? 'Remplacer' : 'Choisir un son'}
        </Button>

        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={handleRemove}>
            Retirer
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
