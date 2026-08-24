import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import type { StoreBusinessType } from '@prisma/client';

/**
 * Données de démonstration MagyaPro Boutique — une boutique fictive par
 * secteur (`StoreBusinessType`), pour qu'un prospect ou un nouveau
 * propriétaire puisse explorer caisse, stock, ventes et rapports avec un
 * jeu de données réaliste avant d'entrer les siennes.
 *
 * Toutes portent `isDemo: true` (site public non indexable, bandeau
 * explicite côté vitrine) et sont créées/retirées depuis l'administration
 * (`/admin/boutiques`, `src/app/api/admin/boutique-demo/route.ts`) —
 * jamais automatiquement, et jamais présentées comme de vraies boutiques.
 */

type DemoProduct = {
  name: string;
  price: number;
  cost: number;
  variants?: Array<{ label: string; price: number; cost: number }>;
};

type DemoCategory = { name: string; products: DemoProduct[] };

type DemoStoreDefinition = {
  slug: string;
  name: string;
  description: string;
  businessType: StoreBusinessType;
  city: string;
  country: string;
  phone: string;
  categories: DemoCategory[];
};

const DEMO_STORES: DemoStoreDefinition[] = [
  {
    slug: 'demo-wax-style',
    name: 'Wax & Style',
    description: 'Prêt-à-porter et pagnes wax, coupes pour toute la famille. Boutique de démonstration Magyapro.',
    businessType: 'CLOTHING',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    phone: '+225 07 00 10 01',
    categories: [
      {
        name: 'Robes',
        products: [
          {
            name: 'Robe wax imprimée',
            price: 15000,
            cost: 8000,
            variants: [
              { label: 'S', price: 15000, cost: 8000 },
              { label: 'M', price: 15000, cost: 8000 },
              { label: 'L', price: 16000, cost: 8500 },
            ],
          },
          { name: 'Robe soirée unie', price: 22000, cost: 12000 },
        ],
      },
      {
        name: 'Chemises',
        products: [
          {
            name: 'Chemise homme col mao',
            price: 12000,
            cost: 6500,
            variants: [
              { label: 'M', price: 12000, cost: 6500 },
              { label: 'L', price: 12000, cost: 6500 },
              { label: 'XL', price: 13000, cost: 7000 },
            ],
          },
          { name: 'Chemise femme légère', price: 9500, cost: 5000 },
        ],
      },
      {
        name: 'Accessoires',
        products: [
          { name: 'Sac à main tissé', price: 8000, cost: 4000 },
          { name: 'Foulard wax', price: 3500, cost: 1500 },
          { name: 'Ceinture cuir', price: 4500, cost: 2000 },
        ],
      },
    ],
  },
  {
    slug: 'demo-techpoint',
    name: 'TechPoint',
    description: 'Téléphones, accessoires et petit électroménager. Boutique de démonstration Magyapro.',
    businessType: 'ELECTRONICS',
    city: 'Dakar',
    country: 'Sénégal',
    phone: '+221 77 00 10 02',
    categories: [
      {
        name: 'Téléphonie',
        products: [
          { name: 'Chargeur rapide USB-C', price: 4000, cost: 1800 },
          { name: 'Écouteurs Bluetooth', price: 12000, cost: 6000 },
          {
            name: 'Coque de protection',
            price: 2500,
            cost: 900,
            variants: [
              { label: 'iPhone', price: 2500, cost: 900 },
              { label: 'Android', price: 2500, cost: 900 },
            ],
          },
        ],
      },
      {
        name: 'Informatique',
        products: [
          { name: 'Souris sans fil', price: 6000, cost: 3000 },
          { name: 'Clé USB 64 Go', price: 5000, cost: 2500 },
          { name: 'Rallonge multiprise', price: 7500, cost: 4000 },
        ],
      },
      {
        name: 'Électroménager',
        products: [
          { name: 'Ventilateur de table', price: 15000, cost: 9000 },
          { name: 'Bouilloire électrique', price: 11000, cost: 6500 },
        ],
      },
    ],
  },
  {
    slug: 'demo-belle-eclat',
    name: 'Belle Éclat',
    description: 'Cosmétiques, soins de la peau et parfums. Boutique de démonstration Magyapro.',
    businessType: 'COSMETICS',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    phone: '+225 07 00 10 03',
    categories: [
      {
        name: 'Soins visage',
        products: [
          { name: 'Crème hydratante', price: 6500, cost: 3200 },
          { name: 'Savon noir gommant', price: 2000, cost: 800 },
          { name: 'Sérum vitamine C', price: 9000, cost: 4500 },
        ],
      },
      {
        name: 'Parfumerie',
        products: [
          {
            name: 'Eau de parfum femme',
            price: 18000,
            cost: 9500,
            variants: [
              { label: '30 ml', price: 12000, cost: 6000 },
              { label: '50 ml', price: 18000, cost: 9500 },
            ],
          },
          { name: 'Déodorant naturel', price: 3000, cost: 1300 },
        ],
      },
      {
        name: 'Capillaire',
        products: [
          { name: 'Huile capillaire', price: 4500, cost: 2000 },
          { name: 'Shampoing hydratant', price: 5000, cost: 2400 },
        ],
      },
    ],
  },
  {
    slug: 'demo-marche-frais',
    name: 'Marché Frais',
    description: 'Épicerie de quartier : produits secs, boissons et frais. Boutique de démonstration Magyapro.',
    businessType: 'GROCERY',
    city: 'Cotonou',
    country: 'Bénin',
    phone: '+229 97 00 10 04',
    categories: [
      {
        name: 'Épicerie',
        products: [
          { name: 'Riz parfumé 5 kg', price: 4500, cost: 3200 },
          { name: 'Huile végétale 1 L', price: 1800, cost: 1300 },
          { name: 'Sucre en poudre 1 kg', price: 1000, cost: 700 },
          { name: 'Tomate concentrée', price: 500, cost: 300 },
        ],
      },
      {
        name: 'Boissons',
        products: [
          { name: 'Eau minérale 1,5 L', price: 500, cost: 300 },
          { name: 'Jus de fruits 1 L', price: 1500, cost: 900 },
          { name: 'Soda 33 cl', price: 600, cost: 350 },
        ],
      },
      {
        name: 'Frais',
        products: [
          { name: 'Œufs (plateau de 30)', price: 3000, cost: 2300 },
          { name: 'Lait en poudre 400 g', price: 2200, cost: 1600 },
        ],
      },
    ],
  },
];

const DEMO_CUSTOMERS = [
  { name: 'Aïcha Diallo', phone: '+225 07 20 20 20' },
  { name: 'Moussa Sow', phone: '+221 77 30 30 30' },
  { name: 'Grace Adjovi', phone: '+229 97 40 40 40' },
  { name: 'Yao Kouadio', phone: '+225 07 50 50 50' },
];

/** Générateur pseudo-aléatoire à graine : le seed produit toujours la même démo. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Crée les 4 boutiques de démonstration (une par secteur), avec catalogue,
 * stock, clients, une promotion et un historique de ventes sur 30 jours.
 * Idempotent : une boutique dont le slug existe déjà est ignorée.
 */
export async function seedStoreDemos(): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const passwordHash = await hashPassword('Demo!2345');

  for (const [storeIndex, definition] of DEMO_STORES.entries()) {
    const existing = await prisma.store.findUnique({
      where: { slug: definition.slug },
      select: { id: true },
    });
    if (existing) {
      skipped.push(definition.name);
      continue;
    }

    const random = seededRandom(20260824 + storeIndex);

    const owner = await prisma.user.create({
      data: {
        email: `${definition.slug}@demo.magyapro.app`,
        name: `Propriétaire ${definition.name}`,
        passwordHash,
        emailVerifiedAt: new Date(),
        isDemo: true,
      },
    });

    const store = await prisma.store.create({
      data: {
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        businessType: definition.businessType,
        status: 'ACTIVE',
        isDemo: true,
        city: definition.city,
        country: definition.country,
        phone: definition.phone,
        email: `contact@${definition.slug}.demo`,
        currency: 'XOF',
        onboardingStep: 5,
        onboardingCompletedAt: new Date(),
        publishedAt: new Date(),
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });

    const warehouse = await prisma.warehouse.create({
      data: { storeId: store.id, name: 'Boutique principale', isDefault: true },
    });

    const variantPool: Array<{ id: string; price: number }> = [];

    for (const [categoryIndex, categoryDef] of definition.categories.entries()) {
      const category = await prisma.storeCategory.create({
        data: { storeId: store.id, name: categoryDef.name, position: categoryIndex },
      });

      for (const productDef of categoryDef.products) {
        const variantsData =
          productDef.variants && productDef.variants.length > 0
            ? productDef.variants.map((variant) => ({
                sku: `${slugify(productDef.name)}-${slugify(variant.label)}`.slice(0, 40),
                attributes: { taille: variant.label },
                price: variant.price,
                cost: variant.cost,
                isActive: true,
              }))
            : [
                {
                  sku: slugify(productDef.name).slice(0, 40),
                  price: productDef.price,
                  cost: productDef.cost,
                  isActive: true,
                },
              ];

        const product = await prisma.storeProduct.create({
          data: {
            storeId: store.id,
            categoryId: category.id,
            name: productDef.name,
            status: 'ACTIVE',
            minStockAlert: 5,
            variants: { create: variantsData },
          },
          include: { variants: true },
        });

        for (const variant of product.variants) {
          const initialStock = 20 + Math.floor(random() * 60);
          await prisma.inventory.create({
            data: { productVariantId: variant.id, warehouseId: warehouse.id, quantity: initialStock },
          });
          variantPool.push({ id: variant.id, price: variant.price });
        }
      }
    }

    await prisma.storePromotion.create({
      data: {
        storeId: store.id,
        code: 'BIENVENUE10',
        type: 'PERCENT',
        value: 10,
        minCartAmount: 5000,
        endsAt: new Date(Date.now() + 60 * 86_400_000),
      },
    });

    const customers = await Promise.all(
      DEMO_CUSTOMERS.map((customer) =>
        prisma.storeCustomer.create({
          data: {
            storeId: store.id,
            name: customer.name,
            phone: customer.phone,
            email: `${customer.phone.replace(/\D/g, '')}@demo.magyapro.app`,
          },
        }),
      ),
    );

    // --- Historique de ventes, réparti sur 30 jours ------------------------
    const saleCount = 30 + Math.floor(random() * 15);
    let counter = 0;

    for (let i = 0; i < saleCount; i++) {
      const lineCount = 1 + Math.floor(random() * 3);
      const items: Array<{
        productVariantId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }> = [];

      const picked = new Set<string>();
      for (let line = 0; line < lineCount; line++) {
        const variant = variantPool[Math.floor(random() * variantPool.length)]!;
        if (picked.has(variant.id)) continue;
        picked.add(variant.id);

        const full = await prisma.storeProductVariant.findUnique({
          where: { id: variant.id },
          include: { product: { select: { name: true } } },
        });
        if (!full) continue;

        const quantity = 1 + Math.floor(random() * 3);
        items.push({
          productVariantId: full.id,
          productName: full.product.name,
          quantity,
          unitPrice: full.price,
          total: full.price * quantity,
        });
      }
      if (items.length === 0) continue;

      counter += 1;
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const withCustomer = random() > 0.4;
      const customer = withCustomer ? customers[Math.floor(random() * customers.length)] : null;
      const createdAt = daysAgo(random() * 30);
      createdAt.setHours(9 + Math.floor(random() * 10), Math.floor(random() * 60));

      const method = random() > 0.5 ? 'cash' : random() > 0.5 ? 'orange_money' : 'wave';

      const sale = await prisma.sale.create({
        data: {
          storeId: store.id,
          number: counter,
          customerId: customer?.id ?? null,
          subtotal,
          total: subtotal,
          createdAt,
          updatedAt: createdAt,
          items: {
            create: items.map((item) => ({
              productVariantId: item.productVariantId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
          payments: { create: { method, amount: subtotal } },
        },
      });

      if (customer) {
        await prisma.storeCustomer.update({
          where: { id: customer.id },
          data: {
            salesCount: { increment: 1 },
            totalSpent: { increment: sale.total },
            lastSaleAt: createdAt,
          },
        });
      }
    }

    await prisma.store.update({ where: { id: store.id }, data: { saleCounter: counter } });

    created.push(definition.name);
  }

  return { created, skipped };
}

/** Retire toutes les boutiques de démonstration (et leurs comptes propriétaires), sans toucher au reste. */
export async function cleanStoreDemos(): Promise<{ deletedStores: number; deletedUsers: number }> {
  const stores = await prisma.store.findMany({ where: { isDemo: true }, select: { id: true } });

  for (const store of stores) {
    await prisma.store.delete({ where: { id: store.id } });
  }

  const { count: deletedUsers } = await prisma.user.deleteMany({
    where: { isDemo: true, email: { endsWith: '@demo.magyapro.app' } },
  });

  return { deletedStores: stores.length, deletedUsers };
}
