'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { ImageUploadField } from '@/components/dashboard/image-upload';
import { Button, Card, EmptyState, inputClass } from '@/components/ui';

type Image = { id: string; imageUrl: string; caption: string | null };

export function GalleryManager({ images }: { images: Image[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>(
    Object.fromEntries(images.map((image) => [image.id, image.caption ?? ''])),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(url: string | null) {
    if (!url) return;
    setUploading(true);
    setError(null);
    try {
      await api.post('/api/galerie', { imageUrl: url });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'image n'a pas pu être ajoutée.");
    } finally {
      setUploading(false);
    }
  }

  async function saveCaption(image: Image) {
    setPendingId(image.id);
    setError(null);
    try {
      await api.patch(`/api/galerie/${image.id}`, { caption: captions[image.id] ?? '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La légende n'a pas pu être enregistrée.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(image: Image) {
    if (!window.confirm('Retirer cette photo de la galerie ?')) return;
    setPendingId(image.id);
    setError(null);
    try {
      await api.delete(`/api/galerie/${image.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'image n'a pas pu être supprimée.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card className="mb-6 p-4 sm:p-5">
        <ImageUploadField
          label="Ajouter une photo"
          folder="covers"
          value={null}
          hint={uploading ? 'Envoi en cours…' : 'Format paysage recommandé. 5 Mo maximum.'}
          onChange={handleUpload}
        />
      </Card>

      {images.length === 0 ? (
        <Card className="p-4 sm:p-5">
          <EmptyState
            title="Galerie vide"
            description="Ajoutez des photos de votre restaurant, de vos plats ou de votre équipe pour enrichir votre site."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
              <img src={image.imageUrl} alt="" className="h-40 w-full object-cover" />
              <div className="p-3">
                <input
                  value={captions[image.id] ?? ''}
                  onChange={(event) =>
                    setCaptions((current) => ({ ...current, [image.id]: event.target.value }))
                  }
                  placeholder="Légende (facultatif)"
                  className={inputClass}
                />
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pendingId === image.id}
                    onClick={() => saveCaption(image)}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pendingId === image.id}
                    onClick={() => remove(image)}
                  >
                    Retirer
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
