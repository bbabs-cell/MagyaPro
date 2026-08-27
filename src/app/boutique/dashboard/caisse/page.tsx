import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { ensureStoreUnitsReady, resolveVariantUnitsBulk } from '@/lib/boutique/units-engine';
import { getEnabledPaymentMethods } from '@/lib/boutique/payment-methods';
import { PageHeader, EmptyState, LinkButton } from '@/components/ui';
import { Pos } from '@/components/boutique/pos';
import { CashSessionBar } from '@/components/boutique/cash-session-bar';
import { OfflineSyncBar } from '@/components/boutique/offline-sync-bar';

export const metadata: Metadata = { title: 'Caisse' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueCaissePage() {
  const context = await requireStore('pos:access');

  // Ces quatre requêtes sont indépendantes entre elles (seule `variants`, plus
  // bas, a besoin du résultat de `defaultWarehouse`) — les lancer en parallèle
  // plutôt qu'en série réduit d'autant le nombre d'allers-retours base de
  // données avant que la caisse ne s'affiche.
  const [defaultWarehouse, customers, paymentMethods, session] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { storeId: context.store.id, isDefault: true },
      select: { id: true },
    }),
    prisma.storeCustomer.findMany({
      where: { storeId: context.store.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, creditBalance: true, creditLimit: true },
    }),
    getEnabledPaymentMethods(context.store.id),
    prisma.cashSession.findFirst({
      where: { storeId: context.store.id, status: 'OPEN' },
      include: {
        cashRegister: { select: { name: true } },
        movements: { select: { type: true, amount: true } },
        sales: { select: { payments: { select: { method: true, amount: true } } } },
      },
    }),
  ]);

  // Reprise paresseuse : sème les unités de la boutique et convertit les
  // fiches antérieures au moteur. Ne fait un vrai travail qu'au tout premier
  // passage (voir `ensureStoreUnitsReady`).
  await ensureStoreUnitsReady(context.store.id, context.store.businessType);

  const variants = await prisma.storeProductVariant.findMany({
    where: { product: { storeId: context.store.id, status: 'ACTIVE' }, isActive: true },
    select: {
      id: true,
      price: true,
      barcode: true,
      product: { select: { name: true, unit: true } },
      inventory: defaultWarehouse
        ? { where: { warehouseId: defaultWarehouse.id }, select: { quantity: true } }
        : false,
    },
    orderBy: { product: { name: 'asc' } },
  });

  const unitsByVariant = await resolveVariantUnitsBulk(variants.map((variant) => variant.id));

  const products = variants.map((variant) => {
    const resolved = unitsByVariant.get(variant.id) ?? [];
    return {
      id: variant.id,
      variantId: variant.id,
      name: variant.product.name,
      price: variant.price,
      unit: variant.product.unit,
      barcode: variant.barcode,
      // Toujours en unité de base — la caisse convertit à l'affichage et à
      // l'ajout au panier, jamais l'inverse.
      stock: variant.inventory?.[0] ? toQty(variant.inventory[0].quantity) : 0,
      units: resolved
        .filter((unit) => unit.isSellable && unit.price !== null)
        .map((unit) => ({
          unitId: unit.unitId,
          label: unit.label,
          labelPlural: unit.labelPlural,
          isDecimal: unit.isDecimal,
          factor: unit.factor,
          price: unit.price,
          isBase: unit.isBase,
        })),
    };
  });

  return (
    <>
      <PageHeader
        title="Caisse"
        description={context.isDemoTour ? 'Consultation uniquement — encaissement désactivé en mode démonstration.' : 'Enregistrez une vente.'}
      />

      <OfflineSyncBar storeId={context.store.id} />

      <CashSessionBar session={session} currency={context.store.currency} />

      {products.length === 0 ? (
        <EmptyState
          title="Aucun produit actif"
          description="Créez et activez au moins un produit pour pouvoir vendre."
          action={
            <LinkButton href="/boutique/dashboard/produits" size="sm">
              Gérer les produits
            </LinkButton>
          }
        />
      ) : (
        <Pos
          storeId={context.store.id}
          products={products}
          customers={customers}
          currency={context.store.currency}
          taxEnabled={context.store.taxEnabled}
          taxRate={context.store.taxRate}
          paymentMethods={paymentMethods.map((m) => ({ value: m.method, label: m.label }))}
          readOnly={context.isDemoTour}
        />
      )}
    </>
  );
}
