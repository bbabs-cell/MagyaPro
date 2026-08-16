import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getTenantContext } from '@/lib/tenant';

/**
 * Reçus imprimables — volontairement hors de `/dashboard` : ces pages sont
 * pensées pour `window.print()` / « Enregistrer en PDF », sans la barre
 * latérale ni le reste du tableau de bord autour. L'accès reste protégé de
 * la même façon (compte connecté, restaurant associé).
 */
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
    <div className="min-h-screen bg-white text-ink">
      <div className="mx-auto max-w-2xl px-6 py-10 print:px-0 print:py-0">{children}</div>
    </div>
  );
}
