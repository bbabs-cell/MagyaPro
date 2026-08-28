'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, cx } from '@/components/ui';

/**
 * Scanner de code-barres par la caméra du téléphone.
 *
 * Utilise `BarcodeDetector`, l'API de décodage intégrée au navigateur : le
 * décodage se fait entièrement sur l'appareil, sans réseau, sans clé d'API et
 * sans coût par scan. Aucun service d'intelligence artificielle payant n'est
 * appelé — ni ici, ni ailleurs dans l'application.
 *
 * L'API n'existe pas partout (Safari iOS notamment, et tout navigateur en
 * HTTP simple, la caméra exigeant une connexion sécurisée). Dans ce cas le
 * bouton explique la situation et renvoie vers les deux méthodes qui
 * fonctionnent partout : la saisie au clavier et la douchette USB/Bluetooth,
 * qui tape le code puis Entrée exactement comme un clavier. L'application
 * reste donc utilisable en entier, quel que soit l'appareil.
 */

/**
 * Types minimaux pour `BarcodeDetector` : l'API n'est pas encore dans les
 * définitions TypeScript du DOM. On ne déclare que ce qu'on utilise.
 */
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
};

/**
 * Formats demandés au décodeur. Les EAN/UPC couvrent les produits du commerce,
 * CODE 128/39 les étiquettes imprimées en interne, QR les étiquettes maison.
 * Restreindre la liste accélère nettement la détection : le navigateur n'essaie
 * pas les vingt formats qu'il connaît à chaque image.
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'];

/** Intervalle entre deux analyses d'image. 250 ms suffit et épargne la batterie. */
const SCAN_INTERVAL_MS = 250;

function detectorConstructor(): BarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === 'function' ? candidate : null;
}

export function BarcodeScannerButton({
  onDetect,
  label = 'Scanner',
  size = 'md',
  iconOnly = false,
  className,
}: {
  /**
   * Appelé avec le code lu. Le composant ferme la caméra juste après : sur un
   * téléphone tenu d'une main, laisser le flux ouvert conduit à scanner deux
   * fois le même article sans s'en rendre compte.
   */
  onDetect: (value: string) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Icône seule, pour les emplacements serrés (une cellule de tableau). */
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  // Détecté après le montage : côté serveur, `window` n'existe pas, et rendre
  // deux balisages différents provoquerait une erreur d'hydratation.
  useEffect(() => {
    setSupported(detectorConstructor() !== null && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        onClick={() => setOpen(true)}
        className={className}
        aria-haspopup="dialog"
        // L'icône seule reste annoncée aux lecteurs d'écran.
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        <CameraIcon />
        {iconOnly ? null : label}
      </Button>
      {open ? (
        <ScannerDialog
          supported={supported === true}
          onClose={() => setOpen(false)}
          onDetect={(value) => {
            setOpen(false);
            onDetect(value);
          }}
        />
      ) : null}
    </>
  );
}

function ScannerDialog({
  supported,
  onDetect,
  onClose,
}: {
  supported: boolean;
  onDetect: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [ready, setReady] = useState(false);

  // Une ref plutôt qu'un état : la boucle de détection ne doit jamais être
  // recréée, et un scan déjà accepté ne doit pas en déclencher un second
  // pendant que la caméra se ferme.
  const doneRef = useRef(false);

  const finish = useCallback(
    (value: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      // Retour haptique quand l'appareil le permet : sur un téléphone tenu au
      // niveau du rayon, l'écran n'est pas toujours dans le champ de vision.
      navigator.vibrate?.(60);
      onDetect(value);
    },
    [onDetect],
  );

  useEffect(() => {
    if (!supported) return;
    const Detector = detectorConstructor();
    if (!Detector) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Caméra arrière : celle qu'on pointe vers l'étiquette.
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const detector = new Detector!({ formats: FORMATS });
        timer = setInterval(async () => {
          if (doneRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) finish(value);
          } catch {
            // Une image illisible entre deux mouvements n'est pas une erreur :
            // la tentative suivante arrive dans un quart de seconde.
          }
        }, SCAN_INTERVAL_MS);
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof Error ? cause.name : '';
        setError(
          name === 'NotAllowedError'
            ? "L'accès à la caméra a été refusé. Autorisez-le dans les réglages de votre navigateur, ou saisissez le code ci-dessous."
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? "Aucune caméra utilisable sur cet appareil. Saisissez le code ci-dessous ou utilisez une douchette."
              : "La caméra n'a pas pu démarrer. Saisissez le code ci-dessous ou utilisez une douchette.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      // Toujours libérer la caméra : un flux laissé ouvert garde la diode
      // allumée et vide la batterie.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [supported, finish]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scanner un code-barres"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-4 shadow-elev2 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Scanner un code-barres</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {supported
                ? 'Cadrez le code-barres. La lecture se fait sur votre appareil, sans envoi sur internet.'
                : 'Votre navigateur ne sait pas lire un code-barres par la caméra.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Fermer
          </button>
        </div>

        {supported && !error ? (
          <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className={cx('h-56 w-full object-cover transition-opacity', ready ? 'opacity-100' : 'opacity-0')}
            />
            {/* Repère de visée : sans lui, on ne sait pas où présenter l'étiquette. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-20 w-4/5 rounded-lg border-2 border-white/80" />
            </div>
            {!ready ? (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
                Ouverture de la caméra…
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-state-bad-soft px-3 py-2 text-sm text-state-bad">
            {error}
          </p>
        ) : null}

        {!supported ? (
          <p className="mt-4 rounded-lg bg-surface-raised px-3 py-2 text-sm text-ink-muted">
            Deux solutions fonctionnent partout : saisir le code ci-dessous, ou brancher une
            douchette USB ou Bluetooth — elle tape le code toute seule dans le champ de recherche.
          </p>
        ) : null}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = manual.trim();
            if (value) finish(value);
          }}
        >
          <label className="sr-only" htmlFor="barcode-manual">
            Saisir le code manuellement
          </label>
          <input
            id="barcode-manual"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Saisir le code manuellement"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <Button type="submit" disabled={manual.trim().length === 0}>
            Valider
          </Button>
        </form>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}
