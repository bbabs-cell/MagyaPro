'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Button } from '@/components/ui';
import { cropAndDownscale } from '@/lib/client/crop-image';
import { photoBrief } from '@/lib/images/briefs';
import {
  CAPTURE_RATIOS,
  DISPLAY_RATIOS,
  safeArea,
  type ImageRole,
} from '@/lib/images/framing';
import type { ImageTarget } from '@/lib/client/downscale-image';

/**
 * Cadrage d'une photo avant envoi.
 *
 * Le défaut corrigé : le restaurateur téléversait une photo et **ne voyait
 * jamais ce qui en serait coupé**. Les templates l'affichent en carré, en 4:3
 * ou dans une cellule de grille selon l'écran, toujours en `object-cover`, qui
 * rogne depuis le centre. Une assiette cadrée un peu haut disparaissait à
 * moitié sur un modèle de site et pas sur un autre.
 *
 * L'aperçu montre le cadre retenu, la zone que tous les modèles conservent, et
 * ce que donnent les deux proportions les plus éloignées. Le recadrage est
 * ensuite appliqué au fichier : ce qui est validé ici est ce qui sera servi.
 */
export function PhotoFramer({
  file,
  role,
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  file: File;
  role: ImageRole;
  target: ImageTarget;
  busy?: boolean;
  onConfirm: (framed: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [working, setWorking] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // L'URL d'objet est révoquée au démontage : sans cela, chaque photo
  // examinée resterait en mémoire jusqu'au rechargement de la page.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const capture = CAPTURE_RATIOS[role];
  const brief = photoBrief(role);
  const safe = safeArea(capture.ratio, DISPLAY_RATIOS[role]);

  // Les deux affichages les plus éloignés : ce sont eux qui coupent le plus,
  // et donc les seuls aperçus qui apprennent quelque chose.
  const ratios = DISPLAY_RATIOS[role];
  const extremes = Array.from(new Set([Math.min(...ratios), Math.max(...ratios)]));

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const frame = frameRef.current;
    if (!frame) return;

    const bounds = frame.getBoundingClientRect();
    const dx = (event.clientX - dragging.current.x) / bounds.width;
    const dy = (event.clientY - dragging.current.y) / bounds.height;
    dragging.current = { x: event.clientX, y: event.clientY };

    setFocus((current) => ({
      x: Math.max(0, Math.min(1, current.x - dx)),
      y: Math.max(0, Math.min(1, current.y - dy)),
    }));
  }

  async function confirm() {
    setWorking(true);
    try {
      const framed = await cropAndDownscale(file, target, capture.ratio, focus);
      await onConfirm(framed);
    } finally {
      setWorking(false);
    }
  }

  const pending = working || busy;
  const objectPosition = `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-sunken p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div>
          <div
            ref={frameRef}
            onPointerDown={(event) => {
              dragging.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={() => {
              dragging.current = null;
            }}
            onPointerCancel={() => {
              dragging.current = null;
            }}
            style={{ aspectRatio: String(capture.ratio) }}
            className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl bg-black/80 active:cursor-grabbing"
          >
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- fichier local, jamais téléversé à ce stade
              <img
                src={preview}
                alt=""
                draggable={false}
                style={{ objectPosition }}
                className="pointer-events-none h-full w-full select-none object-cover"
              />
            )}

            {/* Zone conservée par tous les modèles de site. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
              style={{ width: `${safe.width * 100}%`, height: `${safe.height * 100}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-ink-muted">
            Faites glisser la photo pour placer le sujet dans le cadre en pointillés.
          </p>

          {extremes.length > 1 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink">Ce que verront vos clients</p>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                {extremes.map((ratio) => (
                  <div key={ratio} className="w-28">
                    <div
                      style={{ aspectRatio: String(ratio) }}
                      className="overflow-hidden rounded-lg border border-surface-border bg-black/80"
                    >
                      {preview && (
                        // eslint-disable-next-line @next/next/no-img-element -- fichier local
                        <img
                          src={preview}
                          alt=""
                          draggable={false}
                          style={{ objectPosition }}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-center text-[0.65rem] text-ink-faint">
                      {ratio >= 1 ? `${ratio.toFixed(2)} : 1` : `1 : ${(1 / ratio).toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">{brief.intent}</p>
            <p className="mt-1 text-xs text-ink-muted">{brief.framing}</p>
          </div>

          <ul className="space-y-1.5 text-xs text-ink-muted">
            {brief.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-faint">
                  ·
                </span>
                {tip}
              </li>
            ))}
          </ul>

          <details className="text-xs">
            <summary className="cursor-pointer text-ink-muted underline underline-offset-4">
              À éviter
            </summary>
            <ul className="mt-2 space-y-1.5 text-ink-muted">
              {brief.avoid.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-ink-faint">
                    ·
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => void confirm()}>
          {pending ? 'Préparation…' : 'Utiliser ce cadrage'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Choisir une autre photo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || (focus.x === 0.5 && focus.y === 0.5)}
          onClick={() => setFocus({ x: 0.5, y: 0.5 })}
        >
          Recentrer
        </Button>
      </div>
    </div>
  );
}
