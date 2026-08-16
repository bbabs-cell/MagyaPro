'use client';

import { useEffect, useState } from 'react';

import { AdminSidebar } from '@/components/admin/sidebar';

/**
 * L'administration n'utilise pas les variables `ink`/`surface` (voir
 * `chrome.tsx`) : ses classes sont des utilitaires Tailwind fixes
 * (`bg-navy`, `text-white`, `border-white/10`, ...). Basculer ces classes
 * une par une serait risqué ; on préfère un attribut `data-admin-theme`
 * porté par ce wrapper, que `globals.css` utilise pour surcharger chaque
 * classe concernée en mode clair (voir le bloc `[data-admin-theme='light']`).
 */
const ADMIN_THEME_STORAGE_KEY = 'magyapro:admin-theme';

export function AdminThemeRoot({
  logoUrl,
  userEmail,
  children,
}: {
  logoUrl: string | null;
  userEmail: string;
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

  return (
    <div
      data-admin-theme={theme}
      className="relative min-h-screen overflow-x-hidden bg-navy text-white"
    >
      {theme === 'dark' && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-[#ff5e2e] opacity-[0.12] blur-[120px]"
          />
        </>
      )}

      <div className="relative lg:flex">
        <AdminSidebar
          logoUrl={logoUrl}
          userEmail={userEmail}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main id="contenu" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
