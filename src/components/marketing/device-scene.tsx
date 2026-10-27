import { optimizedImageProps } from '@/lib/optimized-image';

/**
 * Un appareil de la scène : une capture réelle de l'application, détourée,
 * posée dans la composition. Positions en pourcentages de la composition
 * (1600 × 1120), relevées par le script de capture qui l'a produite.
 */
export type SceneDevice = {
  src: string;
  left: number;
  top: number;
  width: number;
  /** Taille réelle du fichier, pour réserver la place avant chargement. */
  size: readonly [number, number];
  /** Délai de montée à l'arrivée, en millisecondes. */
  rise: number;
  /** Décalage de la flottaison, pour que les appareils ne bougent pas ensemble. */
  float: string;
  priority?: boolean;
};

/**
 * La scène des héros Restaurant et Boutique : trois appareils qui montent
 * l'un après l'autre, puis flottent chacun à son rythme, et par-dessus ce qui
 * se passe vraiment dans la journée (`children` : `SceneToast`, `SceneBadge`).
 *
 * Tout le mouvement est sous `prefers-reduced-motion: no-preference`
 * (`globals.css`) : sans lui, la scène s'affiche immobile, notification et
 * pastille comprises.
 */
export function DeviceScene({
  label,
  devices,
  children,
}: {
  label: string;
  devices: readonly SceneDevice[];
  children?: React.ReactNode;
}) {
  return (
    <div role="img" aria-label={label} className="relative aspect-[1600/1120] w-full">
      {devices.map((device) => (
        <div
          key={device.src}
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
              {...optimizedImageProps(device.src, Math.round((device.width / 100) * 760))}
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
      {children}
    </div>
  );
}

/** La notification qui tombe en haut de l'écran principal, en boucle. */
export function SceneToast({
  icon,
  iconClassName,
  title,
  detail,
  delay,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  detail: string;
  delay: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="kd-toast absolute right-[6%] top-[1%] flex w-[58%] min-w-[13rem] items-center gap-2.5 rounded-2xl bg-white/95 p-2.5 pe-3.5 text-[#211d16] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] sm:gap-3 sm:p-3"
      style={{ '--d': delay } as React.CSSProperties}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold sm:h-9 sm:w-9 ${iconClassName}`}
      >
        {icon}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[11px] font-semibold sm:text-sm">{title}</span>
        <span className="block truncate text-[10px] text-[#6a6153] sm:text-xs">{detail}</span>
      </span>
      <span className="ms-auto hidden shrink-0 text-xs text-[#9a9081] sm:inline">maintenant</span>
    </div>
  );
}

/** La pastille qui s'annonce sous le téléphone, en boucle. */
export function SceneBadge({
  className,
  delay,
  children,
}: {
  className: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`kd-toast absolute left-[4%] top-[90%] flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] sm:text-sm ${className}`}
      style={{ '--d': delay } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
