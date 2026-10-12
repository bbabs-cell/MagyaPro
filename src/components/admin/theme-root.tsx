'use client';

import { useEffect, useState } from 'react';

import { AdminSidebar } from '@/components/admin/sidebar';
import { NotificationWatcher } from '@/components/account/notification-watcher';

/**
 * L'administration n'utilise pas les variables `ink`/`surface` (voir
 * `chrome.tsx`) : ses classes sont des utilitaires Tailwind fixes
 * (`bg-navy`, `text-white`, `border-white/10`, ...). Basculer ces classes
 * une par une serait risqué ; on préfère un attribut `data-admin-theme`
 * porté par ce wrapper, que `globals.css` utilise pour surcharger chaque
 * classe concernée en mode clair (voir le bloc `[data-admin-theme='light']`).
 */
const ADMIN_THEME_STORAGE_KEY = 'magyapro:admin-theme';

/**
 * Jetons de couleur des composants partagés avec les tableaux de bord —
 * la barre de navigation du bas, d'abord. Ils lisent `--surface`, `--ink`,
 * `--brand-strong`… : sans ces valeurs, la barre prendrait l'ivoire du
 * Restaurant sur le bleu nuit de l'administration. Même braise que la
 * navigation latérale.
 *
 * `--ink` n'est pas redéfini ici : les boutons blancs de l'administration
 * (`bg-white text-ink`) comptent sur un texte sombre. La barre du bas reçoit
 * le sien dans `sidebar.tsx`.
 */
const ADMIN_TOKENS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--surface': '#0e1b36',
    '--surface-border': 'rgba(255, 255, 255, 0.12)',
    '--ink-faint': 'rgba(255, 255, 255, 0.4)',
    '--surface-sunken': 'rgba(255, 255, 255, 0.05)',
    '--brand-strong': '#d9461c',
    '--brand-text': '#ff8a5c',
    '--brand-ink': '#ffffff',
  },
  light: {
    '--surface': '#ffffff',
    '--surface-border': '#e4ddd0',
    '--ink-faint': '#857a69',
    '--surface-sunken': '#f1ece3',
    '--brand-strong': '#c93f1a',
    '--brand-text': '#b2361a',
    '--brand-ink': '#ffffff',
  },
};

export function AdminThemeRoot({
  logoUrl,
  userEmail,
  unreadNotifications = 0,
  children,
}: {
  logoUrl: string | null;
  userEmail: string;
  /** Notifications de plateforme non lues, pour la pastille de navigation. */
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  // Sombre par défaut : c'est l'apparence historique de l'administration,
  // inchangée tant que l'utilisateur n'a pas explicitement basculé.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    } catch {
      // Stockage indisponible (navigation privée) : on garde le sombre par défaut.
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
      } catch {
        // Le thème reste actif pour la session en cours même sans stockage.
      }
      return next;
    });
  }

  // La racine ne porte volontairement pas d'`overflow-x-hidden`, et c'est le
  // point important. Une valeur d'`overflow` autre que `visible` sur un
  // ancêtre en fait le conteneur de défilement : le menu latéral, pourtant
  // `sticky`, se mettait alors à défiler avec la page au lieu de rester en
  // place. Le tableau de bord Boutique, dont la racine n'a pas cette classe,
  // ne connaissait pas le problème — d'où la différence entre les deux.
  return (
    <div
      data-admin-theme={theme}
      className="relative min-h-screen bg-navy text-white"
      style={ADMIN_TOKENS[theme] as React.CSSProperties}
    >
      {theme === 'dark' && (
        // Le débordement est contenu par cette enveloppe plutôt que par la
        // racine : elle recouvre la page, rogne ce qui dépasse, et n'est le
        // conteneur de défilement de rien puisqu'elle est en position absolue.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />
          {/* `absolute`, jamais `fixed` : un élément fixe avec un décalage
              négatif échappe au rognage de son parent (il n'est pas positionné
              par rapport à lui) et provoque un débordement horizontal fantôme,
              surtout visible sur Chrome Android. */}
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#ff5e2e] opacity-[0.12] blur-[120px]" />
        </div>
      )}

      <NotificationWatcher endpoint="/api/admin/notifications" />

      <div className="relative lg:flex">
        <AdminSidebar
          logoUrl={logoUrl}
          userEmail={userEmail}
          theme={theme}
          onToggleTheme={toggleTheme}
          unreadNotifications={unreadNotifications}
        />

        {/* `pb-24` sous 1024 px : la barre du bas ne recouvre jamais la fin de page. */}
        <main id="contenu" className="min-w-0 flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
