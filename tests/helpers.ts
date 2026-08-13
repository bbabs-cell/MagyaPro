import { PrismaClient } from '@prisma/client';

import { hashPassword } from '@/lib/auth/password';

/**
 * Utilitaires de test : création de tenants complets et nettoyage.
 *
 * Chaque suite construit ses propres restaurants avec des identifiants
 * aléatoires, ce qui évite les collisions entre fichiers et rend les tests
 * indépendants de l'ordre d'exécution.
 */
export const prisma = new PrismaClient();

let counter = 0;

function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export type TestRestaurant = Awaited<ReturnType<typeof createTestRestaurant>>;

/**
 * Crée un restaurant complet : propriétaire, réglages, catégorie, produit,
 * zone de livraison et code promo. C'est le décor minimal permettant de tester
 * une commande de bout en bout.
 */
export async function createTestRestaurant(options?: {
  name?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  currency?: string;
  minOrderAmount?: number;
  productPrice?: number;
}) {
  const slug = unique('resto');
  const passwordHash = await hashPassword('MotDePasse!2345');

  const owner = await prisma.user.create({
    data: {
      email: `${slug}@test.magya`,
      name: `Propriétaire ${slug}`,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name: options?.name ?? `Restaurant ${slug}`,
      status: options?.status ?? 'ACTIVE',
      currency: options?.currency ?? 'XOF',
      onboardingCompletedAt: new Date(),
      settings: {
        create: {
          minOrderAmount: options?.minOrderAmount ?? 0,
          paymentProviders: ['cash_on_delivery', 'pay_at_store'],
        },
      },
      members: { create: { userId: owner.id, role: 'OWNER' } },
      openingHours: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensAt: '00:00',
          closesAt: '23:59',
        })),
      },
    },
  });

  const category = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Plats',
      slug: 'plats',
      position: 0,
    },
  });

  const product = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Plat test',
      slug: 'plat-test',
      price: options?.productPrice ?? 5000,
      position: 0,
      optionGroups: {
        create: {
          name: 'Accompagnement',
          minSelect: 0,
          maxSelect: 2,
          position: 0,
          options: {
            create: [
              { name: 'Riz', priceDelta: 0, position: 0 },
              { name: 'Frites', priceDelta: 500, position: 1 },
            ],
          },
        },
      },
      variants: {
        create: [
          { name: 'Simple', price: options?.productPrice ?? 5000, position: 0 },
          { name: 'Double', price: (options?.productPrice ?? 5000) * 2, position: 1 },
        ],
      },
    },
    include: {
      optionGroups: { include: { options: true } },
      variants: true,
    },
  });

  const zone = await prisma.deliveryZone.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Centre',
      fee: 1000,
      minOrder: 0,
      freeAbove: 20_000,
      position: 0,
    },
  });

  const promotion = await prisma.promotion.create({
    data: {
      restaurantId: restaurant.id,
      code: 'TEST10',
      type: 'PERCENT',
      value: 10,
      minOrder: 0,
    },
  });

  return { restaurant, owner, category, product, zone, promotion };
}

/** Ajoute un membre au restaurant, avec le rôle et les permissions voulus. */
export async function addMember(
  restaurantId: string,
  role: 'ADMIN' | 'EMPLOYEE',
  extraPermissions: string[] = [],
) {
  const slug = unique('membre');
  const user = await prisma.user.create({
    data: {
      email: `${slug}@test.magya`,
      name: `Membre ${slug}`,
      passwordHash: await hashPassword('MotDePasse!2345'),
    },
  });

  const membership = await prisma.restaurantUser.create({
    data: { restaurantId, userId: user.id, role, extraPermissions },
  });

  return { user, membership };
}

/**
 * Vide toutes les tables.
 *
 * `TRUNCATE ... CASCADE` respecte les clés étrangères et remet la base dans un
 * état déterministe entre les suites, sans avoir à ordonner les suppressions.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;

  if (tables.length === 0) return;

  const list = tables.map((row) => `"public"."${row.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
