import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { loadSaleTicket } from '@/lib/boutique/ticket-load';
import { NotFoundError } from '@/lib/errors';

/** Ticket d'une vente, pour la réimprimer depuis l'historique. */
export const GET = route(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireStore('sales:view');
  const { id } = await params;

  const ticket = await loadSaleTicket(context.store, id);
  if (!ticket) throw new NotFoundError('Vente introuvable.');

  return ok({ ticket });
});
