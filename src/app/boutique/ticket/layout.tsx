import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext } from '@/lib/boutique/store-tenant';

/**
 * Tickets de caisse imprimés par le navigateur — page blanche, sans rien
 * autour : elle part telle quelle sur une imprimante de 58 ou 80 mm.
 */
export default async function BoutiqueTicketLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/boutique/connexion');

  const context = await getStoreContext();
  if (!context) redirect('/boutique/dashboard');

  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
