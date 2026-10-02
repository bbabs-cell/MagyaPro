import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NewOrderForm } from '@/components/dashboard/new-order-form';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';

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

  // Laisser composer une commande entière pour la refuser à l'enregistrement
  // serait une perte de temps doublée d'une mauvaise surprise : le plan se
  // vérifie avant d'ouvrir l'écran, et avant même de charger la carte —
  // l'adresse peut être atteinte directement, par un lien gardé en favori
  // depuis une période d'essai ou un plan résilié.
  const entitlements = await getEntitlements(restaurant.id);
  if (!hasFeature(entitlements, FEATURES.COUNTER_ORDERS)) {
    // Les plans qui l'incluent, lus en base : c'est l'administration qui
    // décide où vit cette fonctionnalité, pas le code. Une première version
    // écrivait « Premium » en dur — et affichait, à un restaurant déjà au
    // plan Premium dont la case n'était pas encore cochée, « n'est pas
    // incluse dans le plan Premium… demande le plan Premium ».
    const plans = await prisma.plan.findMany({
      where: {
        product: 'RESTAURANT',
        isActive: true,
        features: { has: FEATURES.COUNTER_ORDERS },
      },
      select: { name: true },
      orderBy: { position: 'asc' },
    });
    const names = plans.map((plan) => plan.name);

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

        <Card className="border-state-warn/30 bg-state-warn-soft p-5">
          <h2 className="text-sm font-medium text-state-warn">
            Non incluse dans votre plan
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            La prise de commande au comptoir et par téléphone n’est pas incluse
            dans le plan {entitlements.planName}. Vos clients peuvent continuer
            à commander depuis votre site.
          </p>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            {names.length > 0
              ? `Elle est disponible avec ${
                  names.length === 1 ? 'le plan' : 'les plans'
                } ${names.join(', ')}.`
              : 'Elle n’est proposée dans aucun plan pour le moment.'}
          </p>
          {names.length > 0 && (
            <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
              Voir les plans
            </LinkButton>
          )}
        </Card>
      </div>
    );
  }

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
