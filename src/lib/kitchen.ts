import { prisma } from '@/lib/db';

/**
 * File de la cuisine : uniquement les commandes déjà confirmées.
 *
 * Une commande `NEW` attend encore une décision du restaurant — l'accepter ou
 * l'annuler. Elle n'apparaît qu'au centre d'alertes et sur l'écran Commandes,
 * jamais ici : la cuisine ne doit jamais préparer un plat qui pourrait encore
 * être refusé.
 *
 * ## Une seule lecture, partagée
 *
 * Cette requête existait en double — une fois dans la page, une fois dans la
 * route que le même écran interroge toutes les douze secondes. Rien
 * n'imposait qu'elles restent identiques, et elles ne l'étaient déjà plus :
 * ajouter la remarque du client à la page seule l'aurait fait apparaître à
 * l'ouverture, puis disparaître douze secondes plus tard, sans que personne
 * comprenne pourquoi. C'est exactement le genre de défaut qu'on ne reproduit
 * pas à la demande.
 */

const SELECT = {
  id: true,
  number: true,
  status: true,
  fulfillmentType: true,
  placedAt: true,
  table: { select: { label: true } },
  /**
   * Remarque écrite par le client — « allergique aux arachides », « pas de
   * sel ». Elle n'était lue nulle part : la seule personne à qui elle
   * s'adresse ne la voyait pas.
   */
  instructions: true,
  items: {
    select: { id: true, productName: true, variantName: true, quantity: true, options: true },
  },
} as const;

export type KitchenOrder = {
  id: string;
  number: number;
  status: 'CONFIRMED' | 'PREPARING' | 'READY';
  fulfillmentType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  placedAt: string;
  table: { label: string } | null;
  instructions: string | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    options: unknown;
  }>;
};

export async function listKitchenOrders(restaurantId: string): Promise<KitchenOrder[]> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
    orderBy: { placedAt: 'asc' },
    select: SELECT,
  });

  return orders.map((order) => ({
    ...order,
    // Le filtre `where` garantit ces trois statuts ; le typage de Prisma, lui,
    // rend l'énumération complète.
    status: order.status as KitchenOrder['status'],
    placedAt: order.placedAt.toISOString(),
  }));
}
