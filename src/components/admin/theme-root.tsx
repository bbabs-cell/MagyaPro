'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/sidebar';
import { NotificationWatcher } from '@/components/account/notification-watcher';

const ADMIN_THEME_STORAGE_KEY = 'magyapro:admin-theme';

/**
 * Jetons du Super Admin, posés sur sa racine.
 *
 * Toutes ses couleurs passent par eux : `fg` (l'encre) et `canvas` (le fond)
 * s'inversent avec le thème, si bien que `text-fg/60` ou `border-fg/10` se
 * lisent pareil sur le bleu nuit et sur l'ivoire. Le mode clair reposait
 * auparavant sur une quarantaine de surcharges « blanc → noir » dans
 * `globals.css` ; neuf cents classes de couleur et une seule oubliée suffisait
 * à rendre un texte invisible — ce qui le rendait inutilisable.
 *
 * - `--domain-*` : une couleur par sujet (voir `tailwind.config.ts`), plus
 *   vive sur fond sombre, plus profonde sur fond clair pour rester lisible
 *   en texte (≥ 4,5:1 sur l'ivoire) ;
 * - `--state-*` : vert, ambre, rouge — les seuls à dire un état ;
 * - `--surface`, `--ink`, `--brand-text`… : lus par la barre de navigation du
 *   bas, partagée avec les tableaux de bord. L'élément actif y prend l'encre
 *   du thème, pas la braise : la braise désigne Restaurant ici.
 */
const ADMIN_TOKENS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--fg': '#ffffff',
    '--canvas': '#0b1730',
    '--domain-resto': '#ff7a4d',
    '--domain-boutique': '#e8c766',
    '--domain-abo': '#a78bfa',
    '--domain-users': '#38bdf8',
    '--domain-comm': '#f472b6',
    '--state-ok': '#6ee7b7',
    '--state-warn': '#fcd34d',
    '--state-bad': '#fca5a5',
    '--surface': '#0e1b36',
    '--surface-border': 'rgba(255, 255, 255, 0.12)',
    '--surface-sunken': 'rgba(255, 255, 255, 0.05)',
    '--ink': '#ffffff',
    '--ink-muted': 'rgba(255, 255, 255, 0.65)',
    '--ink-faint': 'rgba(255, 255, 255, 0.5)',
    '--brand-strong': '#ffffff',
    '--brand-text': '#ffffff',
    '--brand-ink': '#0b1730',
  },
  light: {
    '--fg': '#1c1712',
    '--canvas': '#f7f3ec',
    '--domain-resto': '#c2410c',
    '--domain-boutique': '#856404',
    '--domain-abo': '#6d28d9',
    '--domain-users': '#0369a1',
    '--domain-comm': '#be185d',
    '--state-ok': '#047857',
    '--state-warn': '#b45309',
    '--state-bad': '#b91c1c',
    '--surface': '#fffdf9',
    '--surface-border': '#e4ddd0',
    '--surface-sunken': '#efe9de',
    '--ink': '#1c1712',
    '--ink-muted': '#5f574b',
    '--ink-faint': '#6f665a',
    '--brand-strong': '#1c1712',
    '--brand-text': '#1c1712',
    '--brand-ink': '#f7f3ec',
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
  const pathname = usePathname();

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
      className="relative min-h-screen bg-canvas text-fg"
      // `color-scheme` : listes déroulantes, cases et barres de défilement
      // natives suivent le thème au lieu de rester claires sur le bleu nuit.
      style={{ ...ADMIN_TOKENS[theme], colorScheme: theme } as React.CSSProperties}
    >
      {/* Fond vivant, mais neutre : une trame de points et deux lueurs de la
          couleur de l'encre qui dérivent lentement. Aucune teinte de domaine
          ici — une couleur sans sujet ne voudrait rien dire.
          Le débordement est contenu par cette enveloppe plutôt que par la
          racine : elle recouvre la page, rogne ce qui dépasse, et n'est le
          conteneur de défilement de rien puisqu'elle est en position absolue.
          `absolute`, jamais `fixed` : un élément fixe avec un décalage négatif
          échappe au rognage de son parent et provoque un débordement
          horizontal fantôme, surtout visible sur Chrome Android. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 text-fg opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] animate-drift rounded-full bg-fg opacity-[0.05] blur-[110px]" />
        <div
          className="absolute -left-40 top-[38rem] h-[26rem] w-[26rem] animate-drift rounded-full bg-fg opacity-[0.04] blur-[110px]"
          style={{ animationDelay: '-9s' }}
        />
      </div>

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
          {/* Rejoué à chaque changement d'écran : la page arrive, elle n'est
              pas simplement là. 0,4 s, `transform`/`opacity` seuls. */}
          <div key={pathname} className="mx-auto max-w-6xl animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
