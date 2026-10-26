import { optimizedImageProps } from '@/lib/optimized-image';

/**
 * Le héros de la page Restaurant : l'écran de cuisine de MagyaPro, le vrai,
 * sur les trois appareils d'un restaurant — l'ordinateur de la caisse, la
 * tablette du passe, le téléphone du patron.
 *
 * Trois images séparées (`public/marketing/cuisine-*.webp`, produites par
 * `scripts/capture-hero-cuisine.mjs`), pour que chaque appareil vive à part :
 * ils montent l'un après l'autre à l'arrivée, puis flottent chacun à son
 * rythme. Par-dessus, ce qui se passe vraiment en service : une nouvelle
 * commande tombe sur l'ordinateur, une commande prête s'annonce sur le
 * téléphone — en boucle, sans jamais masquer l'écran.
 *
 * Positions en pourcentages de la composition (1600 × 1120), relevées par le
 * script : si la composition change, le script les affiche.
 *
 * Tout le mouvement est sous `prefers-reduced-motion: no-preference`
 * (`globals.css`) : sans lui, la scène s'affiche immobile, notification et
 * pastille comprises.
 */
const DEVICES = [
  { file: 'ordinateur', left: 5, top: 3.57, width: 85, size: [1632, 972], rise: 0, float: '-1500ms', priority: true },
  { file: 'tablette', left: 50.63, top: 41.96, width: 47.5, size: [912, 650], rise: 220, float: '-4200ms', priority: false },
  { file: 'telephone', left: 2.5, top: 41.96, width: 18.75, size: [360, 746], rise: 380, float: '-2600ms', priority: false },
] as const;

export function KitchenDevices() {
  return (
    <div
      role="img"
      aria-label="L'écran de cuisine de MagyaPro sur un ordinateur, une tablette et un téléphone : les commandes à préparer, en préparation et prêtes, avec leur temps d'attente."
      className="relative aspect-[1600/1120] w-full"
    >
      {DEVICES.map((device) => (
        <div
          key={device.file}
          className="sd-rise absolute"
          style={
            {
              left: `${device.left}%`,
              top: `${device.top}%`,
              width: `${device.width}%`,
              '--d': `${device.rise}ms`,
            } as React.CSSProperties
          }
        >
          <div className="sd-float" style={{ '--d': device.float, '--sd-tilt': '0deg' } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element -- image de plateforme, servie par l'optimiseur */}
            <img
              {...optimizedImageProps(`/marketing/cuisine-${device.file}.webp`, Math.round((device.width / 100) * 760))}
              width={device.size[0]}
              height={device.size[1]}
              alt=""
              decoding="async"
              fetchPriority={device.priority ? 'high' : 'auto'}
              className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      ))}

      {/* Une commande arrive : la notification tombe sur l'ordinateur. */}
      <div
        aria-hidden="true"
        className="kd-toast absolute right-[6%] top-[1%] flex w-[58%] min-w-[13rem] items-center gap-2.5 rounded-2xl bg-white/95 p-2.5 pe-3.5 text-[#211d16] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] sm:gap-3 sm:p-3"
        style={{ '--d': '1.6s' } as React.CSSProperties}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#c93f1a] font-display text-sm font-bold text-white sm:h-9 sm:w-9">
          M
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[11px] font-semibold sm:text-sm">Nouvelle commande n°27</span>
          <span className="block truncate text-[10px] text-[#6a6153] sm:text-xs">Livraison · 2 × Poulet yassa</span>
        </span>
        <span className="ms-auto hidden shrink-0 text-xs text-[#9a9081] sm:inline">maintenant</span>
      </div>

      {/* Et une autre part : la pastille « prête » sur le téléphone. */}
      <div
        aria-hidden="true"
        className="kd-toast absolute left-[4%] top-[90%] flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2f7d4f] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] sm:text-sm"
        style={{ '--d': '5.1s' } as React.CSSProperties}
      >
        <span aria-hidden="true">✓</span> n°6 prête · à remettre
      </div>
    </div>
  );
}
