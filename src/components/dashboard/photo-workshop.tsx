'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api, uploadFile } from '@/lib/client/api';
import { Card, EmptyState } from '@/components/ui';

type ProductWithoutPhoto = { id: string; name: string; categoryName: string };

type AssignmentResult = { productName: string; ok: boolean; error?: string };

export function PhotoWorkshop({ products }: { products: ProductWithoutPhoto[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(products);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<AssignmentResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;

    setProcessing(true);
    const newResults: AssignmentResult[] = [];
    let remaining = [...queue];

    for (const file of images) {
      const target = remaining[0];
      if (!target) {
        newResults.push({
          productName: file.name,
          ok: false,
          error: 'Plus aucun plat sans photo — le reste a été ignoré.',
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'products');
        const uploaded = await uploadFile<{ url: string }>('/api/upload', formData);
        await api.patch(`/api/menu/produits/${target.id}/photo`, { imageUrl: uploaded.url });
        newResults.push({ productName: target.name, ok: true });
        remaining = remaining.slice(1);
      } catch (err) {
        newResults.push({
          productName: target.name,
          ok: false,
          error: err instanceof ApiError ? err.message : 'Échec du téléversement.',
        });
      }
    }

    setQueue(remaining);
    setResults((current) => [...newResults, ...current]);
    setProcessing(false);
    router.refresh();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length > 0) void processFiles(event.dataTransfer.files);
  }

  if (products.length === 0 && queue.length === 0 && results.length === 0) {
    return (
      <Card className="p-4 sm:p-5">
        <EmptyState
          title="Tous vos plats ont déjà une photo"
          description="Ajoutez un nouveau plat sans photo pour utiliser l'atelier."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? 'border-ink bg-surface-sunken' : 'border-surface-border'
          }`}
        >
          <p className="font-medium">Glissez-déposez vos photos ici</p>
          <p className="mt-1 text-sm text-ink-muted">
            Ou{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="underline underline-offset-4"
            >
              choisissez des fichiers
            </button>
            . Chaque photo est attribuée au prochain plat sans photo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) void processFiles(event.target.files);
              event.target.value = '';
            }}
          />
          {processing && <p className="mt-3 text-sm text-ink-muted">Envoi en cours…</p>}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">
          Plats sans photo ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Tous vos plats ont une photo.</p>
        ) : (
          <ol className="mt-3 space-y-1.5 text-sm">
            {queue.map((product, index) => (
              <li key={product.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs text-ink-faint">
                  {index + 1}
                </span>
                <span>
                  {product.name}
                  <span className="text-ink-faint"> · {product.categoryName}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {results.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Résultat du dernier import</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {results.map((result, index) => (
              <li key={index} className={result.ok ? 'text-emerald-700' : 'text-red-700'}>
                {result.ok
                  ? `Photo attribuée à « ${result.productName} »`
                  : `${result.productName} : ${result.error}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
