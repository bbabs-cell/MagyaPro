import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getTenantContext } from '@/lib/tenant';

/**
 * Reçus imprimables — volontairement hors de `/dashboard` : ces pages sont
 * pensées pour `window.print()` / « Enregistrer en PDF », sans la barre
 * latérale ni le reste du tableau de bord autour. L'accès reste protégé de
 * la même façon (compte connecté, restaurant associé).
 *
 * Un reçu reste blanc et sombre à l'impression quel que soit le thème de
 * l'application (économie d'encre, lisibilité sur papier) : les variables
 * `ink`/`surface` sont ici figées sur leurs valeurs claires, plutôt que sur
 * le thème sombre par défaut du reste du produit — les pages de reçu
 * peuvent alors continuer à utiliser les mêmes classes `text-ink-muted`,
 * `border-surface-border`, etc. que partout ailleurs.
 */
const RECEIPT_THEME_VARS = {
  '--surface': '#ffffff',
  '--surface-sunken': '#f6f7f9',
  '--surface-border': '#e4e8ed',
  '--ink': '#12151a',
  '--ink-muted': '#5c6672',
  '--ink-faint': '#8b95a2',
} as const;
export default async function RecuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');

  const context = await getTenantContext();
  if (!context) redirect('/dashboard');

  return (
    <div
      className="min-h-screen bg-surface text-ink"
      style={RECEIPT_THEME_VARS as React.CSSProperties}
    >
      <div className="mx-auto max-w-2xl px-6 py-10 print:px-0 print:py-0">{children}</div>
    </div>
  );
}
