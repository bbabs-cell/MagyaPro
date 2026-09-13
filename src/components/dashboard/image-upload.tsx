'use client';

import { useRef, useState } from 'react';

import { ApiError, uploadFile } from '@/lib/client/api';
import { type ImageTarget } from '@/lib/client/downscale-image';
import { Button } from '@/components/ui';
import { PhotoFramer } from '@/components/dashboard/photo-framer';
import type { ImageRole } from '@/lib/images/framing';

/**
 * Champ de téléversement d'image.
 *
 * Le fichier part vers `/api/upload`, qui le valide et le range sous
 * l'identifiant du restaurant issu de la session. Le composant reçoit en
 * retour une URL, seule valeur persistée sur l'entité.
 */
/**
 * À quoi sert l'image, donc jusqu'où la réduire. Une couverture s'affiche
 * pleine largeur, une vignette de plat jamais plus grande qu'une carte.
 */
const TARGET_BY_FOLDER: Record<string, ImageTarget> = {
  logos: 'logo',
  covers: 'cover',
  products: 'product',
  categories: 'product',
  seo: 'cover',
  chef: 'product',
};

/**
 * Où l'image sera affichée, donc comment elle sera rognée et quelles consignes
 * de prise de vue montrer. Distinct de la cible de réduction ci-dessus : deux
 * images peuvent peser pareil et être cadrées très différemment.
 */
const ROLE_BY_FOLDER: Record<string, ImageRole> = {
  logos: 'logo',
  covers: 'cover',
  products: 'product',
  categories: 'product',
  // L'image de partage est une carte 1,91:1, pas une couverture de page.
  seo: 'social',
  chef: 'chef',
};

export function ImageUploadField({
  label,
  folder,
  value,
  hint,
  role,
  onChange,
}: {
  label: string;
  folder: 'logos' | 'covers' | 'products' | 'categories' | 'seo' | 'chef';
  value: string | null;
  hint?: string;
  /**
   * Où l'image sera affichée, quand le dossier de rangement ne suffit pas à
   * le deviner : les photos de galerie sont rangées avec les couvertures mais
   * affichées en carré, et seraient cadrées pour rien en 3:2.
   */
  role?: ImageRole;
  onChange: (url: string | null) => void | Promise<void>;
}) {
  const imageRole = role ?? ROLE_BY_FOLDER[folder] ?? 'product';
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le fichier choisi attend d'être cadré : rien n'est envoyé tant que le
  // commerçant n'a pas vu ce qui sera coupé.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function clearInput() {
    // Réinitialiser permet de re-sélectionner le même fichier après une erreur.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function upload(prepared: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', prepared);
      formData.append('folder', folder);

      const result = await uploadFile<{ url: string }>('/api/upload', formData);
      await onChange(result.url);
      setPendingFile(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "L'image n'a pas pu être envoyée. Réessayez.",
      );
    } finally {
      setUploading(false);
      clearInput();
    }
  }

  const inputId = `upload-${folder}-${label.replace(/\s+/g, '-').toLowerCase()}`;

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
              if (file) setPendingFile(file);
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

      {pendingFile && (
        <PhotoFramer
          file={pendingFile}
          role={imageRole}
          target={TARGET_BY_FOLDER[folder]!}
          busy={uploading}
          onConfirm={(framed) => upload(framed)}
          onCancel={() => {
            setPendingFile(null);
            clearInput();
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
