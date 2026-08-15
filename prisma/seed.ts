/**
 * Seed de la base.
 *
 * Deux parties bien distinctes :
 *
 *   1. Les **données de référence** — plans, templates, compte Super Admin.
 *      Elles sont nécessaires au fonctionnement de la plateforme et sont
 *      créées de façon idempotente : relancer le seed ne duplique rien.
 *
 *   2. Les **données de démonstration** — trois restaurants fictifs avec menu,
 *      commandes et clients. Toutes portent `isDemo: true`, leur site public
 *      affiche un bandeau explicite et n'est pas indexable. Elles peuvent être
 *      supprimées sans conséquence via `npm run db:seed -- --clean-demo`.
 *
 * Aucune donnée de démonstration n'est présentée comme réelle nulle part dans
 * l'application.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Reproduit `hashPassword` sans importer le module applicatif (alias `@/`). */
async function hashPassword(password: string): Promise<string> {
  const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// ---------------------------------------------------------------- Référence

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Pour démarrer : votre site, votre menu et vos commandes.',
    price: 0,
    currency: 'XOF',
    interval: 'MONTH' as const,
    trialDays: 30,
    features: [],
    limits: { maxProducts: 25, maxCategories: 5, maxUsers: 1 },
    position: 0,
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'Pour développer : promotions, équipe et statistiques.',
    price: 15_000,
    currency: 'XOF',
    interval: 'MONTH' as const,
    trialDays: 14,
    features: [
      'promotions',
      'multiple_users',
      'advanced_analytics',
      'reviews',
      'reservations',
      'table_service',
      'loyalty',
    ],
    limits: { maxProducts: 150, maxCategories: 20, maxUsers: 5 },
    position: 1,
  },
  {
    key: 'premium',
    name: 'Premium',
    description: 'Pour aller plus loin : domaine, templates premium, sans limite.',
    price: 35_000,
    currency: 'XOF',
    interval: 'MONTH' as const,
    trialDays: 14,
    features: [
      'promotions',
      'multiple_users',
      'advanced_analytics',
      'custom_domain',
      'premium_templates',
      'remove_branding',
      'reviews',
      'reservations',
      'table_service',
      'loyalty',
    ],
    limits: { maxProducts: -1, maxCategories: -1, maxUsers: 20 },
    position: 2,
  },
];

const TEMPLATES = [
  {
    key: 'modern',
    name: 'Moderne',
    description:
      'Épuré et lumineux, une grande photo de couverture et un menu en grille.',
    position: 0,
  },
  {
    key: 'african-premium',
    name: 'Africain premium',
    description: 'Teintes chaudes et typographie affirmée.',
    position: 1,
  },
  {
    key: 'fast-food',
    name: 'Fast-food',
    description: 'Direct et efficace : gros visuels, prix visibles.',
    position: 2,
  },
  {
    key: 'traditional',
    name: 'Traditionnel',
    description: "Une carte sobre en une colonne, dans l'esprit d'un menu imprimé.",
    position: 3,
  },
  {
    key: 'elegant',
    name: 'Élégant',
    description: 'Beaucoup d\'espace, typographie fine et contrastes doux.',
    position: 4,
  },
];

async function seedReference() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: { ...plan, limits: plan.limits as never },
      // Les tarifs peuvent avoir été ajustés en administration : on ne les
      // écrase pas à chaque exécution du seed.
      update: { name: plan.name, description: plan.description },
    });
  }
  console.info(`✓ ${PLANS.length} plans`);

  for (const template of TEMPLATES) {
    await prisma.template.upsert({
      where: { key: template.key },
      create: template,
      update: { name: template.name, description: template.description },
    });
  }
  console.info(`✓ ${TEMPLATES.length} templates`);

  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@magyapro.app';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!password) {
    console.warn(
      '⚠ SEED_SUPER_ADMIN_PASSWORD absent : le compte Super Admin n\'est pas créé.',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Le mot de passe n'est jamais réécrit : relancer le seed en production ne
    // doit pas réinitialiser un compte d'administration en service.
    await prisma.user.update({
      where: { email },
      data: { platformRole: 'SUPER_ADMIN', status: 'ACTIVE' },
    });
    console.info(`✓ Super Admin existant confirmé (${email})`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: 'Administration Magyapro',
        passwordHash: await hashPassword(password),
        platformRole: 'SUPER_ADMIN',
        emailVerifiedAt: new Date(),
      },
    });
    console.info(`✓ Super Admin créé (${email})`);
  }
}

// ------------------------------------------------------------ Démonstration

type DemoMenu = Array<{
  category: string;
  products: Array<{
    name: string;
    description: string;
    price: number;
    badge?: 'POPULAR' | 'NEW' | 'PROMOTION';
    compareAtPrice?: number;
    variants?: Array<{ name: string; price: number }>;
    options?: Array<{
      name: string;
      minSelect: number;
      maxSelect: number;
      choices: Array<{ name: string; priceDelta: number }>;
    }>;
  }>;
}>;

const DEMO_RESTAURANTS: Array<{
  slug: string;
  name: string;
  description: string;
  templateKey: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  city: string;
  country: string;
  addressLine: string;
  phone: string;
  planKey: string;
  menu: DemoMenu;
  zones: Array<{ name: string; fee: number; minOrder: number; freeAbove?: number }>;
}> = [
  {
    slug: 'demo-la-terrasse',
    name: 'La Terrasse',
    description:
      'Cuisine de saison et produits frais, servis dans un cadre lumineux. Restaurant de démonstration Magyapro.',
    templateKey: 'modern',
    primaryColor: '#e2483d',
    secondaryColor: '#12151a',
    fontFamily: 'Inter',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    addressLine: 'Boulevard de la Corniche, Cocody',
    phone: '+225 07 00 00 01',
    planKey: 'pro',
    zones: [
      { name: 'Cocody', fee: 1000, minOrder: 3000, freeAbove: 20_000 },
      { name: 'Plateau', fee: 1500, minOrder: 3000 },
      { name: 'Marcory', fee: 2000, minOrder: 5000 },
    ],
    menu: [
      {
        category: 'Entrées',
        products: [
          {
            name: 'Salade de saison',
            description: 'Légumes croquants, vinaigrette maison, graines torréfiées.',
            price: 3500,
          },
          {
            name: 'Velouté du jour',
            description: 'Préparé chaque matin selon le marché.',
            price: 3000,
          },
        ],
      },
      {
        category: 'Plats',
        products: [
          {
            name: 'Poulet rôti aux herbes',
            description: 'Poulet fermier, pommes de terre grenaille, jus corsé.',
            price: 8500,
            badge: 'POPULAR',
            options: [
              {
                name: 'Accompagnement',
                minSelect: 1,
                maxSelect: 1,
                choices: [
                  { name: 'Pommes de terre', priceDelta: 0 },
                  { name: 'Riz parfumé', priceDelta: 0 },
                  { name: 'Légumes vapeur', priceDelta: 500 },
                ],
              },
            ],
          },
          {
            name: 'Filet de capitaine',
            description: 'Poisson du jour, sauce citronnée, riz créole.',
            price: 11_000,
          },
          {
            name: 'Attiéké poisson braisé',
            description: 'Attiéké frais, poisson braisé, sauce tomate piquante.',
            price: 7500,
            badge: 'NEW',
          },
        ],
      },
      {
        category: 'Desserts',
        products: [
          {
            name: 'Tarte ananas',
            description: 'Pâte sablée, ananas caramélisé.',
            price: 3000,
          },
          {
            name: 'Salade de fruits frais',
            description: 'Fruits de saison découpés à la commande.',
            price: 2500,
          },
        ],
      },
      {
        category: 'Boissons',
        products: [
          {
            name: 'Jus de bissap',
            description: 'Hibiscus infusé, peu sucré.',
            price: 1500,
            variants: [
              { name: '33 cl', price: 1500 },
              { name: '50 cl', price: 2000 },
            ],
          },
          { name: 'Eau minérale', description: 'Bouteille 50 cl.', price: 1000 },
        ],
      },
    ],
  },
  {
    slug: 'demo-chez-aminata',
    name: 'Chez Aminata',
    description:
      'Spécialités ouest-africaines préparées à la commande, recettes de famille. Restaurant de démonstration Magyapro.',
    templateKey: 'african-premium',
    primaryColor: '#c2410c',
    secondaryColor: '#1c1917',
    fontFamily: 'Poppins',
    city: 'Dakar',
    country: 'Sénégal',
    addressLine: 'Rue 10, Medina',
    phone: '+221 77 000 00 02',
    planKey: 'premium',
    zones: [
      { name: 'Medina', fee: 1000, minOrder: 2500, freeAbove: 15_000 },
      { name: 'Plateau', fee: 1500, minOrder: 2500 },
    ],
    menu: [
      {
        category: 'Grillades',
        products: [
          {
            name: 'Dibi mouton',
            description: 'Mouton grillé, oignons confits, moutarde.',
            price: 6000,
            badge: 'POPULAR',
            variants: [
              { name: 'Portion', price: 6000 },
              { name: 'Grande portion', price: 9500 },
            ],
          },
          {
            name: 'Poulet yassa',
            description: 'Poulet mariné au citron, oignons fondants, riz blanc.',
            price: 5500,
          },
        ],
      },
      {
        category: 'Plats mijotés',
        products: [
          {
            name: 'Thieboudienne',
            description: 'Riz au poisson, légumes du marché, sauce tomate.',
            price: 5000,
            badge: 'POPULAR',
            options: [
              {
                name: 'Suppléments',
                minSelect: 0,
                maxSelect: 3,
                choices: [
                  { name: 'Poisson supplémentaire', priceDelta: 1500 },
                  { name: 'Piment', priceDelta: 0 },
                  { name: 'Citron', priceDelta: 0 },
                ],
              },
            ],
          },
          {
            name: 'Mafé bœuf',
            description: 'Bœuf mijoté à la pâte d\'arachide, riz blanc.',
            price: 5500,
          },
        ],
      },
      {
        category: 'Boissons',
        products: [
          { name: 'Bouye', description: 'Jus de baobab frais.', price: 1200 },
          { name: 'Gingembre', description: 'Jus de gingembre pressé.', price: 1200 },
        ],
      },
    ],
  },
  {
    slug: 'demo-burger-lab',
    name: 'Burger Lab',
    description:
      'Burgers préparés minute, pain brioché maison, frites fraîches. Restaurant de démonstration Magyapro.',
    templateKey: 'fast-food',
    primaryColor: '#dc2626',
    secondaryColor: '#111827',
    fontFamily: 'Space Grotesk',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    addressLine: 'Rue des Jardins, Deux Plateaux',
    phone: '+225 07 00 00 03',
    planKey: 'starter',
    zones: [{ name: 'Deux Plateaux', fee: 1000, minOrder: 4000, freeAbove: 12_000 }],
    menu: [
      {
        category: 'Burgers',
        products: [
          {
            name: 'Classic Cheese',
            description: 'Bœuf 150 g, cheddar, cornichons, sauce maison.',
            price: 4500,
            badge: 'POPULAR',
            options: [
              {
                name: 'Cuisson',
                minSelect: 1,
                maxSelect: 1,
                choices: [
                  { name: 'À point', priceDelta: 0 },
                  { name: 'Bien cuit', priceDelta: 0 },
                ],
              },
              {
                name: 'Suppléments',
                minSelect: 0,
                maxSelect: 4,
                choices: [
                  { name: 'Bacon', priceDelta: 800 },
                  { name: 'Cheddar supplémentaire', priceDelta: 500 },
                  { name: 'Oignons frits', priceDelta: 500 },
                  { name: 'Œuf', priceDelta: 600 },
                ],
              },
            ],
          },
          {
            name: 'Double Smash',
            description: 'Deux steaks smashés, double cheddar, sauce fumée.',
            price: 6500,
            compareAtPrice: 7500,
            badge: 'PROMOTION',
          },
          {
            name: 'Veggie Deluxe',
            description: 'Galette de légumes, avocat, roquette.',
            price: 4500,
          },
        ],
      },
      {
        category: 'Accompagnements',
        products: [
          {
            name: 'Frites maison',
            description: 'Pommes de terre fraîches, sel de mer.',
            price: 1500,
            variants: [
              { name: 'Petite', price: 1500 },
              { name: 'Grande', price: 2200 },
            ],
          },
          { name: 'Onion rings', description: 'Panure croustillante.', price: 2000 },
        ],
      },
      {
        category: 'Boissons',
        products: [
          {
            name: 'Soda',
            description: 'Au choix.',
            price: 1000,
            variants: [
              { name: '33 cl', price: 1000 },
              { name: '50 cl', price: 1400 },
            ],
          },
          { name: 'Milkshake vanille', description: 'Glace vanille, lait entier.', price: 2500 },
        ],
      },
    ],
  },
];

const DEMO_CUSTOMERS = [
  { name: 'Awa Koné', phone: '+225 07 11 11 11' },
  { name: 'Ibrahim Traoré', phone: '+225 07 22 22 22' },
  { name: 'Fatou Ndiaye', phone: '+221 77 33 33 33' },
  { name: 'Marc Kouassi', phone: '+225 07 44 44 44' },
  { name: 'Sarah Bamba', phone: '+225 07 55 55 55' },
];

/** Générateur pseudo-aléatoire à graine : le seed produit toujours la même démo. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

async function seedDemo() {
  const random = seededRandom(20260813);
  const passwordHash = await hashPassword('Demo!2345');

  for (const [index, definition] of DEMO_RESTAURANTS.entries()) {
    const existing = await prisma.restaurant.findUnique({
      where: { slug: definition.slug },
      select: { id: true },
    });
    if (existing) {
      console.info(`· ${definition.name} existe déjà, ignoré`);
      continue;
    }

    const plan = await prisma.plan.findUnique({ where: { key: definition.planKey } });

    const owner = await prisma.user.create({
      data: {
        email: `${definition.slug}@demo.magyapro.app`,
        name: `Propriétaire ${definition.name}`,
        passwordHash,
        emailVerifiedAt: new Date(),
        isDemo: true,
      },
    });

    const restaurant = await prisma.restaurant.create({
      data: {
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        status: 'ACTIVE',
        isDemo: true,
        templateKey: definition.templateKey,
        primaryColor: definition.primaryColor,
        secondaryColor: definition.secondaryColor,
        fontFamily: definition.fontFamily,
        city: definition.city,
        country: definition.country,
        addressLine: definition.addressLine,
        phone: definition.phone,
        email: `contact@${definition.slug}.demo`,
        currency: 'XOF',
        onboardingStep: 5,
        onboardingCompletedAt: new Date(),
        publishedAt: new Date(),
        seoDescription: definition.description.slice(0, 160),
        settings: {
          create: {
            minOrderAmount: 2000,
            prepTimeMinutes: 25 + index * 5,
            paymentProviders: ['cash_on_delivery', 'pay_at_store'],
            notificationEmail: `contact@${definition.slug}.demo`,
          },
        },
        members: { create: { userId: owner.id, role: 'OWNER' } },
        openingHours: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            isClosed: dayOfWeek === 1,
            opensAt: '11:00',
            closesAt: '23:00',
          })),
        },
        domains: {
          create: {
            hostname: definition.slug,
            type: 'SUBDOMAIN',
            status: 'VERIFIED',
            verificationToken: randomBytes(16).toString('hex'),
            verifiedAt: new Date(),
            isPrimary: true,
          },
        },
        deliveryZones: {
          create: definition.zones.map((zone, position) => ({
            name: zone.name,
            fee: zone.fee,
            minOrder: zone.minOrder,
            freeAbove: zone.freeAbove ?? null,
            position,
          })),
        },
        ...(plan
          ? {
              subscription: {
                create: {
                  planId: plan.id,
                  status: 'ACTIVE',
                  currentPeriodEnd: daysFromNow(30),
                },
              },
            }
          : {}),
      },
    });

    // --- Menu ------------------------------------------------------------
    const createdProducts: Array<{ id: string; price: number }> = [];

    for (const [categoryIndex, categoryDef] of definition.menu.entries()) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: categoryDef.category,
          slug: categoryDef.category
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
          position: categoryIndex,
        },
      });

      for (const [productIndex, productDef] of categoryDef.products.entries()) {
        const product = await prisma.product.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: productDef.name,
            slug: productDef.name
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, ''),
            description: productDef.description,
            price: productDef.price,
            compareAtPrice: productDef.compareAtPrice ?? null,
            badge: productDef.badge ?? 'NONE',
            position: productIndex,
            variants: {
              create: (productDef.variants ?? []).map((variant, position) => ({
                name: variant.name,
                price: variant.price,
                position,
              })),
            },
            optionGroups: {
              create: (productDef.options ?? []).map((group, position) => ({
                name: group.name,
                minSelect: group.minSelect,
                maxSelect: group.maxSelect,
                position,
                options: {
                  create: group.choices.map((choice, choicePosition) => ({
                    name: choice.name,
                    priceDelta: choice.priceDelta,
                    position: choicePosition,
                  })),
                },
              })),
            },
          },
        });

        createdProducts.push({ id: product.id, price: product.price });
      }
    }

    // --- Promotion --------------------------------------------------------
    await prisma.promotion.create({
      data: {
        restaurantId: restaurant.id,
        code: 'BIENVENUE10',
        type: 'PERCENT',
        value: 10,
        minOrder: 5000,
        maxRedemptions: 100,
        endsAt: daysFromNow(60),
      },
    });

    // --- Clients et commandes ---------------------------------------------
    // Les commandes sont réparties sur 45 jours pour que les graphiques et
    // les comparaisons de période aient de la matière.
    const zones = await prisma.deliveryZone.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { position: 'asc' },
    });

    const customers = await Promise.all(
      DEMO_CUSTOMERS.map((customer) =>
        prisma.customer.create({
          data: {
            restaurantId: restaurant.id,
            name: customer.name,
            phone: customer.phone,
            email: `${customer.phone.replace(/\D/g, '')}@demo.magyapro.app`,
          },
        }),
      ),
    );

    const orderCount = 24 + Math.floor(random() * 12);
    let counter = 0;

    for (let i = 0; i < orderCount; i++) {
      counter += 1;
      const customer = customers[Math.floor(random() * customers.length)]!;
      const placedAt = daysAgo(Math.floor(random() * 45));
      // Concentration sur les heures de service, comme un vrai restaurant.
      placedAt.setHours(11 + Math.floor(random() * 11), Math.floor(random() * 60));

      const lineCount = 1 + Math.floor(random() * 3);
      const items: Array<{
        productId: string;
        productName: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      }> = [];

      for (let line = 0; line < lineCount; line++) {
        const picked = createdProducts[Math.floor(random() * createdProducts.length)]!;
        const full = await prisma.product.findUnique({
          where: { id: picked.id },
          select: { name: true, price: true },
        });
        if (!full) continue;

        const quantity = 1 + Math.floor(random() * 2);
        items.push({
          productId: picked.id,
          productName: full.name,
          unitPrice: full.price,
          quantity,
          lineTotal: full.price * quantity,
        });
      }

      if (items.length === 0) continue;

      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const isDelivery = random() > 0.35;
      const zone = isDelivery ? zones[Math.floor(random() * zones.length)] : undefined;
      const deliveryFee =
        zone && (zone.freeAbove === null || subtotal < zone.freeAbove) ? zone.fee : 0;

      // Statut cohérent avec l'ancienneté : une commande d'il y a trois
      // semaines n'est plus « en préparation ».
      const ageInDays = (Date.now() - placedAt.getTime()) / 86_400_000;
      const status =
        ageInDays > 2
          ? random() > 0.12
            ? ('COMPLETED' as const)
            : ('CANCELLED' as const)
          : ([ 'NEW', 'CONFIRMED', 'PREPARING', 'READY' ] as const)[
              Math.floor(random() * 4)
            ]!;

      const total = subtotal + deliveryFee;

      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          number: counter,
          status,
          fulfillmentType: isDelivery ? 'DELIVERY' : 'PICKUP',
          paymentStatus: status === 'COMPLETED' ? 'PAID' : 'PENDING',
          paymentProvider: isDelivery ? 'cash_on_delivery' : 'pay_at_store',
          customerName: customer.name,
          customerPhone: customer.phone,
          deliveryAddress: isDelivery ? `${definition.addressLine} (démo)` : null,
          subtotal,
          deliveryFee,
          total,
          currency: 'XOF',
          deliveryZoneId: zone?.id ?? null,
          placedAt,
          statusUpdatedAt: placedAt,
          completedAt: status === 'COMPLETED' ? placedAt : null,
          cancelledAt: status === 'CANCELLED' ? placedAt : null,
          items: { create: items },
          events: { create: { toStatus: status, createdAt: placedAt } },
        },
      });

      if (status !== 'CANCELLED') {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            ordersCount: { increment: 1 },
            totalSpent: { increment: total },
            lastOrderAt: placedAt,
          },
        });
      }
    }

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { orderCounter: counter },
    });

    // Trafic mesuré, pour que le taux de conversion soit calculable. Un seul
    // aller-retour réseau (`createMany`) plutôt que 180 `create()` dans une
    // transaction : sur une connexion distante, la latence cumulée des
    // requêtes individuelles dépassait le délai par défaut de la transaction.
    const events = Array.from({ length: 180 }, () => ({
      restaurantId: restaurant.id,
      type: 'PAGE_VIEW' as const,
      path: random() > 0.5 ? '/' : '/menu',
      visitorId: `demo-visitor-${Math.floor(random() * 120)}`,
      occurredAt: daysAgo(random() * 45),
    }));
    await prisma.analyticsEvent.createMany({ data: events });

    console.info(
      `✓ ${definition.name} — ${createdProducts.length} plats, ${counter} commandes`,
    );
  }
}

/** Retire toutes les données de démonstration, sans toucher au reste. */
async function cleanDemo() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isDemo: true },
    select: { id: true, name: true },
  });

  for (const restaurant of restaurants) {
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
    console.info(`✓ ${restaurant.name} supprimé`);
  }

  const { count } = await prisma.user.deleteMany({ where: { isDemo: true } });
  console.info(`✓ ${count} comptes de démonstration supprimés`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--clean-demo')) {
    console.info('\nSuppression des données de démonstration\n');
    await cleanDemo();
    return;
  }

  console.info('\nDonnées de référence\n');
  await seedReference();

  if (!args.includes('--no-demo')) {
    console.info('\nDonnées de démonstration\n');
    await seedDemo();
    console.info(
      '\nComptes de démonstration : <slug>@demo.magyapro.app / Demo!2345',
    );
  }

  console.info('\nTerminé.\n');
}

main()
  .catch((error) => {
    console.error('Échec du seed :', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
