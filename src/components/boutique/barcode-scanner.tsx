'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, cx } from '@/components/ui';

/**
 * Scanner de code-barres par la caméra du téléphone.
 *
 * ## Un seul geste
 *
 * « Scanner » ouvre la caméra en plein écran, tout de suite. On vise, c'est
 * lu. Il n'y a rien d'autre à comprendre :
 *
 * - **À la caisse** (`continuous`), la caméra reste ouverte : chaque article
 *   lu part au panier, le téléphone vibre, le nom de l'article s'affiche en
 *   vert. On enchaîne les articles, puis « Terminé ». Un même code n'est pas
 *   relu avant une seconde et demie : sans ce délai, un article tenu devant
 *   l'objectif s'ajoutait quatre fois par seconde.
 * - **Dans une fiche produit**, la caméra se ferme dès le premier code lu :
 *   on cherche un code, pas une liste.
 *
 * ## Partout, sans service payant
 *
 * Le décodage se fait **sur l'appareil**, sans réseau ni clé d'API :
 *
 * - par `BarcodeDetector`, le décodeur intégré du navigateur, quand il existe
 *   (Chrome sur Android) ;
 * - sinon par ZXing compilé en WebAssembly (paquet `barcode-detector`, MIT),
 *   chargé seulement à l'ouverture. C'est ce qui manquait : Safari, donc
 *   **tous les iPhone**, n'a pas `BarcodeDetector`, et le scanner n'y
 *   affichait qu'un message d'excuse. Le moteur (`zxing_reader.wasm`) est
 *   servi par le site lui-même (`public/vendor/zxing/`, copié au build par
 *   `scripts/copier-zxing.mjs`), jamais par un CDN tiers.
 *
 * ## Toujours au-dessus de la page
 *
 * La fenêtre est rendue dans `document.body` (portail), pas à l'endroit du
 * bouton. Placée dans la page, elle héritait de la référence de position de
 * ses ancêtres : un ancêtre animé suffisait à l'étirer sur toute la hauteur
 * de la page, et il fallait défiler pour trouver la caméra.
 *
 * Restent possibles partout : taper le code à la main, ou une douchette
 * USB/Bluetooth, qui tape le code puis Entrée dans le champ de recherche.
 */

type Detected = { rawValue: string };
type Detector = { detect(source: CanvasImageSource): Promise<Detected[]> };

/**
 * Le retour d'un code lu, affiché sur la caméra. `action` propose une suite
 * (« Associer ce code à un produit ») : la toucher ferme la caméra et la lance.
 */
export type ScanResult = { ok: boolean; message: string; action?: { label: string; run: () => void } };

/**
 * Formats lus. EAN/UPC : produits du commerce ; CODE 128/39 et ITF :
 * étiquettes imprimées ; QR : étiquettes maison. Une liste courte accélère
 * la lecture : le décodeur n'essaie pas tous les formats à chaque image.
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

/** Intervalle entre deux analyses : assez vif, sans vider la batterie. */
const SCAN_INTERVAL_MS = 200;
/** Délai avant de relire le même code (mode continu). */
const SAME_CODE_COOLDOWN_MS = 1500;

/** Le décodeur : celui du navigateur s'il lit nos formats, ZXing sinon. */
async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as {
    BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?(): Promise<string[]> };
  }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? FORMATS;
      const formats = FORMATS.filter((format) => supported.includes(format));
      if (formats.length > 0) return new Native({ formats });
    } catch {
      // Décodeur natif présent mais inutilisable : on passe à ZXing.
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? `/vendor/zxing/${path}` : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: FORMATS as never });
}

export function BarcodeScannerButton({
  onDetect,
  continuous = false,
  label = 'Scanner',
  size = 'md',
  iconOnly = false,
  className,
}: {
  /**
   * Appelé avec chaque code lu. En mode continu, son retour s'affiche sur
   * la caméra (« Eau minérale ajoutée », « Code inconnu »).
   */
  onDetect: (value: string) => ScanResult | void;
  /** Caméra ouverte jusqu'à « Terminé » — la caisse. */
  continuous?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Icône seule, pour les emplacements serrés (une cellule de tableau). */
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

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
        style={{ touchAction: 'manipulation' }}
      >
        <BarcodeIcon />
        {iconOnly ? null : label}
      </Button>
      {open
        ? createPortal(
            <ScannerOverlay
              continuous={continuous}
              onClose={() => setOpen(false)}
              onDetect={(value) => {
                const result = onDetect(value);
                if (!continuous && !result?.action) setOpen(false);
                return result;
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function ScannerOverlay({
  continuous,
  onDetect,
  onClose,
}: {
  continuous: boolean;
  onDetect: (value: string) => ScanResult | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<(ScanResult & { at: number }) | null>(null);
  const [count, setCount] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');

  // Dernier code accepté et son instant : une ref, pour que la boucle de
  // lecture ne soit jamais recréée.
  const last = useRef<{ value: string; at: number } | null>(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const accept = useCallback((value: string) => {
    const now = performance.now();
    if (last.current && last.current.value === value && now - last.current.at < SAME_CODE_COOLDOWN_MS) return;
    last.current = { value, at: now };
    // Vibration : le téléphone est tenu vers le rayon, l'écran n'est pas
    // toujours dans le champ de vision.
    navigator.vibrate?.(60);
    const result = onDetectRef.current(value);
    if (result) {
      setFeedback({ ...result, at: now });
      if (result.ok) setCount((n) => n + 1);
      else navigator.vibrate?.([40, 60, 40]);
    }
  }, []);

  // La caméra et la boucle de lecture.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext
            ? 'Ce navigateur ne donne pas accès à la caméra. Saisissez le code à la main.'
            : 'La caméra ne s’ouvre que sur une adresse sécurisée (https). Saisissez le code à la main.',
        );
        setState('error');
        setManualOpen(true);
        return;
      }
      try {
        const [media, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            // Caméra arrière, et assez de définition pour les petits codes.
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          createDetector(),
        ]);
        stream = media;
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState('scanning');

        const loop = async () => {
          if (cancelled) return;
          const current = videoRef.current;
          if (current && current.readyState >= 2) {
            try {
              const codes = await detector.detect(current);
              const value = codes[0]?.rawValue?.trim();
              if (value && !cancelled) accept(value);
            } catch {
              // Une image floue entre deux mouvements n'est pas une erreur.
            }
          }
          if (!cancelled) timer = setTimeout(loop, SCAN_INTERVAL_MS);
        };
        void loop();
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof Error ? cause.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'L’accès à la caméra est refusé. Autorisez-le dans les réglages du navigateur pour ce site, ou saisissez le code à la main.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'Aucune caméra sur cet appareil. Saisissez le code à la main, ou branchez une douchette.'
              : 'La caméra n’a pas pu démarrer. Saisissez le code à la main.',
        );
        setState('error');
        setManualOpen(true);
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // Toujours libérer la caméra : un flux ouvert garde la diode allumée
      // et vide la batterie.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [accept]);

  // Échap ferme ; la page derrière ne défile pas pendant le scan.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Le message de retour s'efface seul — plus lentement s'il propose une
  // suite, pour laisser le temps de la toucher.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), feedback.action ? 8000 : 1800);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scanner un code-barres"
      className="fixed inset-0 z-[60] flex animate-veil flex-col bg-black text-white"
    >
      {/* La caméra occupe tout l'écran : c'est elle qu'on regarde. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          className={cx(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            state === 'scanning' ? 'opacity-100' : 'opacity-0',
          )}
        />

        {state !== 'error' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-8">
            {/* Le cadre de visée : on sait où présenter l'étiquette. Il
                passe au vert à chaque article lu. */}
            <div
              className={cx(
                'relative aspect-[16/9] w-full max-w-sm rounded-2xl border-[3px] shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)] transition-colors duration-200',
                feedback?.ok ? 'border-emerald-400' : feedback ? 'border-red-400' : 'border-white/90',
              )}
            >
              {state === 'scanning' && (
                <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              )}
            </div>
            <p className="rounded-full bg-black/55 px-4 py-2 text-center text-sm font-medium">
              {state === 'starting' ? 'Ouverture de la caméra…' : 'Visez le code-barres'}
            </p>
          </div>
        )}

        {/* Ce qui vient d'être lu, en grand : le vendeur regarde le rayon,
            pas un texte de 12 px. */}
        {feedback && (
          <div
            key={feedback.at}
            role="status"
            className={cx(
              'absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] animate-scale-in rounded-2xl px-4 py-3 text-center text-base font-semibold shadow-elev2',
              feedback.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white',
            )}
          >
            {feedback.ok ? '✓ ' : ''}
            {feedback.message}
            {feedback.action && (
              <button
                type="button"
                onClick={() => {
                  const run = feedback.action!.run;
                  onClose();
                  run();
                }}
                className="mt-3 block h-12 w-full rounded-xl bg-white text-base font-semibold text-red-600 active:scale-[0.98]"
              >
                {feedback.action.label}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p role="alert" className="max-w-sm rounded-2xl bg-white/10 p-4 text-center text-sm leading-relaxed">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Les commandes, au pouce, sous la caméra. */}
      <div className="space-y-3 bg-black p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {manualOpen ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = manual.trim();
              if (!value) return;
              setManual('');
              last.current = null;
              accept(value);
            }}
          >
            <label className="sr-only" htmlFor="barcode-manual">
              Code-barres
            </label>
            <input
              id="barcode-manual"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="Taper le code"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className="h-12 min-w-0 flex-1 rounded-xl border border-white/25 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus:border-white focus:outline-none"
            />
            <Button type="submit" size="lg" disabled={manual.trim().length === 0}>
              OK
            </Button>
          </form>
        ) : null}

        <div className="flex gap-2">
          {!manualOpen && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="h-12 flex-1 rounded-xl border border-white/25 text-sm font-medium text-white/85"
            >
              Taper le code
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl bg-white text-base font-semibold text-black active:scale-[0.98]"
          >
            {continuous && count > 0 ? `Terminé · ${count} article${count > 1 ? 's' : ''}` : continuous ? 'Terminé' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BarcodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
    </svg>
  );
}
