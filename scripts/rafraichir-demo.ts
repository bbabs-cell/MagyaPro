/**
 * Rajeunit les commandes en cours des vitrines de démonstration.
 *
 * Le seed ne crée de commandes « en cours » que si elles datent de moins de
 * deux jours — une commande d'il y a trois semaines n'est plus en
 * préparation. Mais il ne tourne qu'une fois : seize jours plus tard, ces
 * mêmes commandes attendent toujours, et l'écran de cuisine affiche une
 * attente de deux semaines. Capturé pour une publicité, c'est inmontrable.
 *
 * Ce script redonne à ces commandes l'âge qu'elles avaient au seed : quelques
 * minutes. Il ne crée rien, ne supprime rien, ne touche à aucun montant.
 *
 * ## Trois bornes, et aucune n'est négociable
 *
 * - **Base locale uniquement.** L'hôte de `DATABASE_URL` doit être
 *   `localhost` ou `127.0.0.1`. Ce script réécrit des dates : lancé par
 *   erreur contre la production, il fausserait l'historique de vrais
 *   commerces.
 * - **Vitrines de démonstration uniquement** (`isDemo`), jamais un
 *   restaurant réel, même en local.
 * - **Commandes en cours uniquement.** Les commandes terminées ou annulées
 *   gardent leur date : ce sont elles qui portent les statistiques, et les
 *   rajeunir déformerait les courbes.
 *
 * ## Emploi
 *
 *   npx tsx scripts/rafraichir-demo.ts
 */
import { prisma } from '../src/lib/db';

const ACTIVE = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const;

function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL absent.');
  const host = new URL(raw).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    // L'hôte est affiché, jamais l'adresse complète : elle porte le mot de
    // passe de la base.
    throw new Error(
      `Refusé : la base visée est sur « ${host} ». Ce script réécrit des dates ` +
        'et ne s’exécute que contre une base locale.',
    );
  }
}

async function main(): Promise<void> {
  assertLocalDatabase();

  const orders = await prisma.order.findMany({
    where: { status: { in: [...ACTIVE] }, restaurant: { isDemo: true } },
    select: { id: true, number: true, restaurantId: true },
    orderBy: [{ restaurantId: 'asc' }, { number: 'asc' }],
  });

  if (orders.length === 0) {
    console.log('Aucune commande en cours dans les vitrines de démonstration.');
    return;
  }

  // Étalées de 3 à 14 minutes : un écran de service réel n'a pas toutes ses
  // commandes arrivées à la même seconde, et la plus ancienne doit rester en
  // tête de file, comme l'écran les trie.
  const now = Date.now();
  await prisma.$transaction(
    orders.map((order, index) => {
      const minutesAgo = 14 - Math.round((index / Math.max(1, orders.length - 1)) * 11);
      const placedAt = new Date(now - minutesAgo * 60_000);
      return prisma.order.update({
        where: { id: order.id },
        data: { placedAt, statusUpdatedAt: placedAt },
      });
    }),
  );

  console.log(`${orders.length} commande(s) en cours rajeunie(s), de 14 à 3 minutes.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
