'use client';

import { useState } from 'react';

/**
 * Logo Magyapro.
 *
 * Une seule source : l'image envoyée depuis Administration → Images → « Logo
 * Magyapro ». Il n'existe plus de marque dessinée en dur dans le code.
 *
 * L'ancienne version en contenait une, un carré bleu surmonté d'un dôme
 * orange, affichée dès que l'image n'était pas disponible. Une marque de repli
 * est une mauvaise idée pour un produit qui a un vrai logo : elle réapparaît
 * au moindre incident de chargement, elle vieillit sans que personne la
 * remplace, et elle finit par exister à côté de la vraie identité sans que
 * personne sache laquelle fait foi.
 *
 * Sans image, il ne reste donc que le nom écrit. C'est volontaire : mieux vaut
 * un logotype sobre qu'un ancien symbole ressuscité.
 */
export function Logo({
  src,
  className = 'h-8 w-8',
  textClassName = 'text-lg',
  showText = true,
}: {
  /** URL du logo envoyé par le Super Admin. Absent ou en erreur : seul le nom s'affiche. */
  src?: string | null;
  className?: string;
  textClassName?: string;
  showText?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex items-center gap-2">
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- hôte de stockage arbitraire
        <img
          src={src}
          alt="Magyapro"
          className={`${className} object-contain`}
          onError={() => setFailed(true)}
        />
      )}
      {showText && (
        <span className={`font-semibold tracking-tight ${textClassName}`}>
          Magya<span className="text-[#ff5e2e]">pro</span>
        </span>
      )}
    </span>
  );
}
