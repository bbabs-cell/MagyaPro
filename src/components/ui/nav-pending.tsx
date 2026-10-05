'use client';

import { useLinkStatus } from 'next/link';

/**
 * Le retour immédiat d'un clic dans le menu, à placer **dans** le `<Link>`.
 *
 * Mesuré dans le tableau de bord Boutique : rien ne changeait à l'écran entre
 * le clic et la réponse du serveur. En local, c'était court ; en production,
 * avec une base distante, c'est ce silence qui faisait dire « ça ne répond
 * pas ». `useLinkStatus` passe à « en cours » à l'image même du clic, avant
 * toute réponse : l'entrée touchée s'allume, et une fine barre avance sous
 * elle tant que la page arrive.
 *
 * La barre décélère sans jamais atteindre le bout : elle dit « ça vient »,
 * jamais « c'est arrivé ». L'arrivée, c'est la page elle-même.
 *
 * `data-nav-pending` est lu par `scripts/audit-clics.mjs` pour mesurer ce
 * premier retour.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      data-nav-pending="true"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 origin-left animate-nav-progress rounded-full bg-current opacity-70"
    />
  );
}
