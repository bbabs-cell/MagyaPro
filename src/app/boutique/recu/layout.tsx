import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext } from '@/lib/boutique/store-tenant';

/**
 * Reçus imprimables Boutique — même principe que `/recu` côté Restaurant :
 * hors de `/boutique/dashboard`, pensés pour `window.print()`, avec les
 * couleurs figées en clair quel que soit le thème du reste du produit.
 */
const RECEIPT_THEME_VARS = {
  '--surface': '#ffffff',
  '--surface-sunken': '#f6f7f9',
  '--surface-border': '#e4e8ed',
  '--ink': '#12151a',
  '--ink-muted': '#5c6672',
  '--ink-faint': '#8b95a2',
} as const;

export default async function BoutiqueRecuLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/boutique/connexion');

  const context = await getStoreContext();
  if (!context) redirect('/boutique/dashboard');

  return (
    <div className="min-h-screen bg-surface text-ink" style={RECEIPT_THEME_VARS as React.CSSProperties}>
      <div className="mx-auto max-w-2xl px-6 py-10 print:px-0 print:py-0">{children}</div>
    </div>
  );
}
