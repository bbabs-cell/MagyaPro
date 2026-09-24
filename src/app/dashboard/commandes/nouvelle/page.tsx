import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NewOrderForm } from '@/components/dashboard/new-order-form';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Nouvelle commande' };
export const dynamic = 'force-dynamic';

/**
 * Prise de commande au comptoir ou par téléphone.
 *
 * Tout est chargé ici, côté serveur : la carte, les zones de livraison et les
 * tables. Le formulaire est un écran de service — il doit répondre au geste
 * sans attendre un aller-retour réseau à chaque plat ajouté.
 *
 * Seuls les plats disponibles sont proposés. Un plat marqué épuisé n'a pas à
 * apparaître dans une liste où l'on clique vite : le serveur le refuserait,
 * mais après que le client se soit entendu dire oui.
 */
export default async function NewOrderPage() {
  const { restaurant } = await requireTenant('orders:create');

  const [products, zones, tables] = await Promise.all([
    prisma.product.findMany({
      where: { restaurantId: restaurant.id, isAvailable: true },
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
        variants: {
          where: { isAvailable: true },
          select: { id: true, name: true, price: true },
          orderBy: { position: 'asc' },
        },
        optionGroups: {
          select: {
            id: true,
            name: true,
            minSelect: true,
            maxSelect: true,
            options: {
              where: { isAvailable: true },
              select: { id: true, name: true, priceDelta: true },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }],
    }),
    prisma.deliveryZone.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      select: { id: true, name: true, fee: true },
      orderBy: { position: 'asc' },
    }),
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, label: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle commande"
        description="Pour un client qui appelle, ou qui commande au comptoir."
        action={
          <Link
            href="/dashboard/commandes"
            className="inline-flex min-h-11 items-center text-sm text-ink-muted underline-offset-4 hover:underline"
          >
            Retour
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="Votre carte est vide"
          description="Ajoutez au moins un plat disponible avant de prendre une commande."
        />
      ) : (
        <NewOrderForm
          currency={restaurant.currency}
          zones={zones}
          tables={tables}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            categoryName: product.category?.name ?? 'Sans catégorie',
            variants: product.variants,
            optionGroups: product.optionGroups,
          }))}
        />
      )}
    </div>
  );
}
