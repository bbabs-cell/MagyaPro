'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Thème du tableau de bord Boutique — clair (« Comptoir ») ou sombre
 * (« Atelier »), voir `globals.css`.
 *
 * L'attribut est posé sur `<html>` plutôt que sur un conteneur du tableau de
 * bord, pour deux raisons : le script anti-clignotement du `layout` peut
 * l'écrire avant que le moindre composant existe, et les éléments rendus hors
 * du flux (menu mobile en `fixed`, futurs dialogues) en héritent aussi.
 *
 * Il est retiré au démontage : le reste du produit — Restaurant, sites
 * publics, administration — garde son thème clair unique, y compris après une
 * navigation côté client depuis le tableau de bord.
 */

const STORAGE_KEY = 'magyapro:boutique-theme';

export type BoutiqueTheme = 'light' | 'dark';

function apply(theme: BoutiqueTheme): void {
  document.documentElement.dataset.boutiqueTheme = theme;
}

export function useBoutiqueTheme() {
  // « light » à l'état initial pour que le rendu serveur et la première passe
  // client concordent ; la valeur réellement stockée est relue juste après,
  // le script du `layout` ayant déjà peint la bonne couleur entre-temps.
  const [theme, setTheme] = useState<BoutiqueTheme>('light');

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible (navigation privée, quota) : thème clair.
    }
    const initial: BoutiqueTheme = stored === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    apply(initial);

    return () => {
      delete document.documentElement.dataset.boutiqueTheme;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: BoutiqueTheme = current === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Choix non mémorisé : il tiendra au moins le temps de la session.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
