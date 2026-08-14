import { NextResponse } from 'next/server';

import { route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

/**
 * Export complet des données du restaurant, au format JSON.
 *
 * Une sauvegarde de secours et un moyen de partir avec ses données : rien
 * n'est propriétaire de Magyapro. Les commandes et clients sont inclus tels
 * quels ; c'est au restaurateur de traiter ce fichier avec la même prudence
 * que n'importe quel export contenant des coordonnées de clients.
 */
export const GET = route(async () => {
  const { restaurant } = await requireTenant('settings:manage');

  const ORDER_EXPORT_LIMIT = 10_000;

  const [profile, settings, openingHours, categories, products, promotions, loyaltyTiers, tables, deliveryZones, customers, ordersCount, orders] =
    await Promise.all([
      prisma.restaurant.findUnique({ where: { id: restaurant.id } }),
      prisma.restaurantSettings.findUnique({ where: { restaurantId: restaurant.id } }),
      prisma.openingHour.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.category.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.product.findMany({
        where: { restaurantId: restaurant.id },
        include: { variants: true, optionGroups: { include: { options: true } } },
      }),
      prisma.promotion.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.loyaltyTier.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.restaurantTable.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.deliveryZone.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.customer.findMany({ where: { restaurantId: restaurant.id } }),
      prisma.order.count({ where: { restaurantId: restaurant.id } }),
      prisma.order.findMany({
        where: { restaurantId: restaurant.id },
        include: { items: true },
        orderBy: { placedAt: 'desc' },
        take: ORDER_EXPORT_LIMIT,
      }),
    ]);

  // Une sauvegarde qui tronquerait silencieusement une partie des commandes
  // ne serait pas une sauvegarde : le fichier dit explicitement s'il est
  // complet, pour qu'on ne s'y fie pas à tort.
  const ordersTruncated = ordersCount > orders.length;

  const backup = {
    exportedAt: new Date().toISOString(),
    ordersTotal: ordersCount,
    ordersExported: orders.length,
    ordersTruncated,
    restaurant: profile,
    settings,
    openingHours,
    categories,
    products,
    promotions,
    loyaltyTiers,
    tables,
    deliveryZones,
    customers,
    orders,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="magyapro-${restaurant.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
