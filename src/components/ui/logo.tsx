'use client';

import { useState } from 'react';
import { optimizedImageProps } from '@/lib/optimized-image';

/**
 * Logo MagyaPro.
 *
 * Une seule source : l'image envoyée depuis Administration → Images → « Logo
 * MagyaPro ». Il n'existe plus de marque dessinée en dur dans le code.
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
  product = 'restaurant',
}: {
  /** URL du logo envoyé par le Super Admin. Absent ou en erreur : seul le nom s'affiche. */
  src?: string | null;
  className?: string;
  textClassName?: string;
  showText?: boolean;
  /**
   * Produit dont c'est le logo : il fixe la couleur de « Pro ». Braise pour
   * Restaurant (et la plateforme), or pour Boutique — la même signature que
   * leurs pages de présentation et leurs tableaux de bord respectifs.
   */
  product?: 'restaurant' | 'boutique';
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex items-center gap-2">
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- hôte de stockage arbitraire
        <img
          // Affiché de 28 à 56 px : on ne télécharge plus le fichier d'origine.
          {...optimizedImageProps(src, 64)}
          alt="MagyaPro"
          className={`${className} object-contain`}
          onError={() => setFailed(true)}
        />
      )}
      {showText && (
        <span className={`font-semibold tracking-tight ${textClassName}`}>
          Magya
          <span className={product === 'boutique' ? 'text-[#e0bd52]' : 'text-[#ff5e2e]'}>Pro</span>
        </span>
      )}
    </span>
  );
}
