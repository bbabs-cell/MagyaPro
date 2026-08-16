'use client';

import { useState } from 'react';

type GalleryImage = { id: string; imageUrl: string; caption: string | null };

/**
 * Galerie avec pop-up : cliquer une photo l'ouvre en grand, avec
 * navigation précédent/suivant — comme la lightbox du template Sarab
 * (galPop), sans dépendance externe (juste un peu d'état React).
 */
export function GalleryLightbox({ images }: { images: GalleryImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const current = openIndex !== null ? images[openIndex] : null;

  function close() {
    setOpenIndex(null);
  }

  function prev() {
    setOpenIndex((index) => (index === null ? null : (index - 1 + images.length) % images.length));
  }

  function next() {
    setOpenIndex((index) => (index === null ? null : (index + 1) % images.length));
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative overflow-hidden rounded-2xl text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
            <img
              src={image.imageUrl}
              alt={image.caption ?? ''}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            {image.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {image.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ✕
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                prev();
              }}
              aria-label="Photo précédente"
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              ←
            </button>
          )}

          <figure
            className="max-h-[85vh] max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image de tenant */}
            <img
              src={current.imageUrl}
              alt={current.caption ?? ''}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
            {current.caption && (
              <figcaption className="mt-3 text-center text-sm text-white/80">{current.caption}</figcaption>
            )}
          </figure>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                next();
              }}
              aria-label="Photo suivante"
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              →
            </button>
          )}
        </div>
      )}
    </>
  );
}
