'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api, uploadFile } from '@/lib/client/api';

/**
 * Son joué dans l'espace Super Admin à l'arrivée d'une notification.
 *
 * Composant propre à l'administration plutôt que le `SoundUploadField`
 * partagé : celui-ci s'appuie sur les jetons `ink`/`surface` du produit, que
 * l'admin n'utilise pas (voir `admin/theme-root.tsx`).
 */
export function PlatformSoundSettings({ soundUrl }: { soundUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadFile('/api/admin/notification-sound', formData);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le son n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.delete('/api/admin/notification-sound');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le son n'a pas pu être retiré.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 p-5">
      <h2 className="text-sm font-medium">Son de notification</h2>
      <p className="mt-1 text-sm text-white/50">
        Joué dans cet espace à l&apos;arrivée d&apos;un paiement à valider. Sans fichier, un bip
        est généré par le navigateur. MP3, WAV ou OGG, 1 Mo maximum.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {soundUrl && (
        <audio controls src={soundUrl} className="mt-4 h-10 w-full max-w-sm">
          Votre navigateur ne peut pas lire ce son.
        </audio>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/ogg"
          id="platform-sound"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <label
          htmlFor="platform-sound"
          className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-white/20 px-3 text-sm text-white/70 hover:bg-white/10"
        >
          {busy ? 'Envoi…' : soundUrl ? 'Remplacer' : 'Choisir un son'}
        </label>
        {soundUrl && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="h-9 rounded-lg px-3 text-sm text-white/50 hover:text-white disabled:opacity-50"
          >
            Retirer
          </button>
        )}
      </div>
    </section>
  );
}
