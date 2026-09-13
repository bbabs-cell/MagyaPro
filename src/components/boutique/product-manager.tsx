'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import Link from 'next/link';

import { ApiError, api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import {
  STOCK_RAIL,
  formatCompositeStock,
  stockState,
  type UnitOption,
} from '@/lib/boutique/units';
import { buildCombinations, combinationKey, type VariantAxis } from '@/lib/boutique/variants';
import { StockWithdrawalForm } from '@/components/boutique/stock-withdrawal-form';
import { BarcodeScannerButton } from '@/components/boutique/barcode-scanner';
import {
  EXPIRY_ICONS,
  EXPIRY_LABELS,
  EXPIRY_RAIL,
  expiryLabel,
  expiryState,
  type ExpiryState,
} from '@/lib/boutique/expiry';
import { SECTOR_VARIANT_AXES, attributeSuggestionsFor } from '@/lib/boutique/unit-catalogue';
import { AlertMessage, Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

/**
 * Catalogue MagyaPro Boutique — première version : un produit = une seule
 * variante (voir `storeProductSchema`), pas encore de vraies variantes
 * multiples (tailles, couleurs...). La table `StoreProductVariant` les
 * prendra en charge quand cette fonctionnalité sera construite ; le champ
 * unique déjà présent en base n'a besoin d'aucune migration pour ça.
 */

type Category = { id: string; name: string; productCount: number };
type BrandRow = { id: string; name: string; productCount: number };
/** Unité de la boutique, telle que proposée dans les sélecteurs de la fiche. */
type StoreUnit = {
  id: string;
  code: string;
  label: string;
  labelPlural: string;
  isDecimal: boolean;
  /** Conversion habituelle dans cette boutique — pré-remplissage seulement. */
  defaultFactor: number | null;
};

/** Conditionnement déclaré sur une variante : conversion + prix propres. */
type VariantUnit = {
  unitId: string;
  factor: number;
  price: number | null;
  cost: number | null;
  isSellable: boolean;
  isPurchasable: boolean;
};

type Variant = {
  id: string;
  sku: string | null;
  barcode: string | null;
  cost: number;
  price: number;
  isActive: boolean;
  attributes: Record<string, string>;
  units: VariantUnit[];
  /**
   * Date du lot le plus proche de sa péremption, en ISO. `null` quand aucune
   * date n'a été renseignée à la réception — le cas de la plupart des
   * produits non périssables.
   */
  expiryDate?: string | null;
};

/** Ligne de l'éditeur de déclinaisons — valeurs en saisie, donc en texte. */
type DeclinationDraft = {
  key: string;
  /** Absent = déclinaison à créer. */
  id?: string;
  attributes: Record<string, string>;
  sku: string;
  barcode: string;
  cost: string;
  price: string;
  initialStock: string;
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  minStockAlert: number;
  maxStock: number | null;
  supplierLeadDays: number | null;
  unit: string;
  baseUnitId: string | null;
  /** Axes de déclinaison — vide pour un produit simple. */
  variantAxes: VariantAxis[];
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  variants: Array<Variant & { inventory: Array<{ quantity: number; warehouseId: string }> }>;
};

/** Ligne de l'éditeur de conditionnements — valeurs en saisie, donc en texte. */
type UnitDraft = {
  key: string;
  unitId: string;
  factor: string;
  price: string;
  cost: string;
};

let draftCounter = 0;
function newDraftKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

const STATUS_LABELS: Record<Product['status'], string> = {
  ACTIVE: 'Actif',
  DRAFT: 'Brouillon',
  ARCHIVED: 'Archivé',
};

const STATUS_TONES: Record<Product['status'], 'success' | 'neutral' | 'warning'> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'warning',
};

/**
 * Filtres rapides de la liste. Volontairement courts et exclusifs : sur un
 * téléphone, une rangée de pastilles se balaie du pouce, là où un panneau de
 * filtres combinables demande de réfléchir avant de chercher.
 */
type ListFilter = 'all' | 'low' | 'out' | 'expiring';

const FILTER_LABELS: Record<ListFilter, string> = {
  all: 'Tous',
  low: 'Stock faible',
  out: 'Rupture',
  expiring: 'Péremption',
};

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'pièce(s)',
  KG: 'kg',
  GRAM: 'g',
  LITER: 'L',
  MILLILITER: 'mL',
  PACK: 'pack(s)',
};

export function ProductManager({
  initialCategories,
  initialBrands,
  initialProducts,
  storeUnits,
  currency,
  canManage,
  businessType,
  now,
}: {
  initialCategories: Category[];
  initialBrands: BrandRow[];
  initialProducts: Product[];
  /** Unités actives de la boutique — voir `StoreUnit`. */
  storeUnits: StoreUnit[];
  currency: string;
  canManage: boolean;
  businessType: string;
  /** Instant de référence figé par le serveur — voir la page Produits. */
  now: number;
}) {
  const mutation = useServerMutation();

  /**
   * Données du serveur, lues telles quelles.
   *
   * Elles étaient auparavant recopiées dans un `useState` sans jamais être
   * remises à jour. Or `useState` ignore sa valeur initiale à tous les rendus
   * suivants : la liste restait figée sur son contenu du premier affichage.
   * Chaque `router.refresh()` de cet écran renvoyait donc des données
   * fraîches que rien ne montrait — un produit créé, un prix corrigé, une
   * ligne supprimée n'apparaissaient qu'après un rechargement complet de la
   * page.
   */
  const categories = initialCategories;
  const brands = initialBrands;
  const products = initialProducts;
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [withdrawing, setWithdrawing] = useState<Product | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');

  /**
   * État de péremption d'un produit : celui de sa déclinaison la plus
   * urgente. Un seul carton périmé suffit à marquer la fiche — c'est celui-là
   * qu'il faut sortir du rayon.
   */
  function productExpiry(product: Product): { state: ExpiryState; label: string | null } {
    const order: ExpiryState[] = ['expired', 'critical', 'soon', 'ok'];
    let worst: ExpiryState = 'ok';
    let worstDate: string | null = null;

    for (const variant of product.variants) {
      if (!variant.expiryDate) continue;
      const state = expiryState(variant.expiryDate, now);
      if (order.indexOf(state) < order.indexOf(worst)) {
        worst = state;
        worstDate = variant.expiryDate;
      }
    }

    return { state: worst, label: worstDate ? expiryLabel(worstDate, now) : null };
  }

  function totalStock(product: Product): number {
    return product.variants.reduce(
      (sum, variant) =>
        sum + variant.inventory.reduce((vSum, inv) => vSum + inv.quantity, 0),
      0,
    );
  }

  /**
   * Liste effectivement affichée. La recherche porte sur le nom, la référence
   * interne et le code-barres : trois façons dont un commerçant désigne le
   * même article selon qu'il le lit, l'a saisi ou le scanne.
   */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products.filter((product) => {
      if (needle) {
        const matches =
          product.name.toLowerCase().includes(needle) ||
          product.variants.some(
            (variant) =>
              variant.sku?.toLowerCase().includes(needle) ||
              variant.barcode?.toLowerCase().includes(needle),
          );
        if (!matches) return false;
      }

      if (filter === 'all') return true;

      const stock = product.variants.reduce(
        (sum, variant) => sum + variant.inventory.reduce((v, inv) => v + inv.quantity, 0),
        0,
      );
      if (filter === 'out') return stock <= 0;
      if (filter === 'low') return stockState(stock, product.minStockAlert) === 'low';
      return productExpiry(product).state !== 'ok';
    });
    // `productExpiry` et `stockState` sont des fonctions pures des données déjà
    // listées en dépendances ; les ajouter forcerait un recalcul à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, filter, now]);

  /** Compte par filtre, affiché sur les pastilles — un filtre à zéro se voit avant d'être touché. */
  const counts = useMemo(() => {
    const result: Record<ListFilter, number> = {
      all: products.length,
      low: 0,
      out: 0,
      expiring: 0,
    };
    for (const product of products) {
      const stock = product.variants.reduce(
        (sum, variant) => sum + variant.inventory.reduce((v, inv) => v + inv.quantity, 0),
        0,
      );
      if (stock <= 0) result.out += 1;
      else if (stockState(stock, product.minStockAlert) === 'low') result.low += 1;
      if (productExpiry(product).state !== 'ok') result.expiring += 1;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, now]);

  const unitById = new Map(storeUnits.map((unit) => [unit.id, unit]));
  const unitLabelById = new Map(storeUnits.map((unit) => [unit.id, unit.label]));

  /**
   * Unités d'un produit au format attendu par `formatCompositeStock` — l'unité
   * de base d'abord, puis ses conditionnements. Vide tant que la fiche n'a pas
   * d'unité de base : l'affichage retombe alors sur l'unité héritée.
   */
  function unitOptionsFor(product: Product): UnitOption[] {
    const base = product.baseUnitId ? unitById.get(product.baseUnitId) : null;
    if (!base) {
      const legacy = UNIT_LABELS[product.unit] ?? '';
      return [
        {
          unitId: 'legacy',
          label: legacy,
          labelPlural: legacy,
          isDecimal: false,
          factor: 1,
          price: null,
          isBase: true,
        },
      ];
    }

    const options: UnitOption[] = [
      {
        unitId: base.id,
        label: base.label,
        labelPlural: base.labelPlural,
        isDecimal: base.isDecimal,
        factor: 1,
        price: null,
        isBase: true,
      },
    ];

    for (const unit of product.variants[0]?.units ?? []) {
      const definition = unitById.get(unit.unitId);
      if (!definition) continue;
      options.push({
        unitId: definition.id,
        label: definition.label,
        labelPlural: definition.labelPlural,
        isDecimal: definition.isDecimal,
        factor: unit.factor,
        price: unit.price,
        isBase: false,
      });
    }

    return options;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button size="sm" onClick={() => setShowForm(true)}>
              + Nouveau produit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCategoryForm(true)}>
              + Catégorie
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowBrandForm(true)}>
              + Marque
            </Button>
          </>
        )}
      </div>

      {showCategoryForm && (
        <QuickAddForm
          label="Nom de la catégorie"
          placeholder="Vêtements homme"
          endpoint="/api/boutique/categories"
          field="name"
          onDone={() => mutation.settled('Catégorie ajoutée.', () => setShowCategoryForm(false))}
          onCancel={() => setShowCategoryForm(false)}
        />
      )}

      {showBrandForm && (
        <QuickAddForm
          label="Nom de la marque"
          placeholder="Nike"
          endpoint="/api/boutique/brands"
          field="name"
          onDone={() => mutation.settled('Marque ajoutée.', () => setShowBrandForm(false))}
          onCancel={() => setShowBrandForm(false)}
        />
      )}

      {showForm && (
        <ProductForm
          categories={categories}
          brands={brands}
          storeUnits={storeUnits}
          currency={currency}
          businessType={businessType}
          onDone={() => mutation.settled('Produit ajouté.', () => setShowForm(false))}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          categories={categories}
          brands={brands}
          storeUnits={storeUnits}
          currency={currency}
          businessType={businessType}
          onDone={() => mutation.settled('Produit modifié.', () => setEditingProduct(null))}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {withdrawing && withdrawing.variants[0] && (
        <StockWithdrawalForm
          productName={withdrawing.name}
          variantId={withdrawing.variants[0].id}
          stock={totalStock(withdrawing)}
          units={unitOptionsFor(withdrawing)}
          onDone={() => setWithdrawing(null)}
          onCancel={() => setWithdrawing(null)}
        />
      )}

      {products.length === 0 ? (
        <EmptyState
          title="Aucun produit pour le moment"
          description="Ajoutez votre premier produit pour commencer à suivre votre stock."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setShowForm(true)}>
                Ajouter un produit
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Recherche et filtres. Passé une trentaine de références, faire
              défiler toute la liste pour retrouver un article devient le
              geste le plus coûteux de cet écran — c'est ce qui manquait. */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un produit, une référence, un code-barres…"
                aria-label="Rechercher dans le catalogue"
                className={cx(inputClass, 'flex-1')}
              />
              <BarcodeScannerButton
                onDetect={(code) => setQuery(code)}
                label="Scanner pour rechercher"
                iconOnly
                className="shrink-0"
              />
            </div>

            {/* `flex-wrap` : les pastilles passent à la ligne plutôt que d'être
                rognées, sinon le dernier filtre devient inatteignable sur un
                écran étroit. */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as ListFilter[]).map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(key)}
                    style={{ touchAction: 'manipulation' }}
                    className={cx(
                      'rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
                      active
                        ? 'border-ink bg-ink text-white'
                        : 'border-surface-border text-ink hover:bg-surface-sunken',
                      // Un filtre vide reste cliquable mais s'annonce comme
                      // vide : plus honnête que de le masquer, ce qui ferait
                      // douter de son existence.
                      !active && counts[key] === 0 && 'opacity-50',
                    )}
                  >
                    {FILTER_LABELS[key]}
                    <span className={cx('ml-1.5 tabular-nums', active ? 'text-white/70' : 'text-ink-faint')}>
                      {counts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun produit ne correspond"
              description={
                query
                  ? `Rien ne correspond à « ${query} ». Vérifiez l'orthographe, ou cherchez sur une partie du nom seulement.`
                  : 'Aucun produit dans cette catégorie pour le moment.'
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Tout afficher
                </Button>
              }
            />
          ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Marque</th>
                <th className="px-4 py-3 text-right font-medium">Prix</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                {canManage && <th className="px-4 py-3 font-medium">&nbsp;</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const variant = product.variants[0];
                const activeVariants = product.variants.filter((v) => v.isActive);
                const stock = totalStock(product);
                const state = stockState(stock, product.minStockAlert);
                const expiry = productExpiry(product);
                return (
                  <tr
                    key={product.id}
                    // Rail de statut : sur une longue liste, la couleur repère
                    // les ruptures et les seuils franchis sans avoir à lire
                    // chaque chiffre. La péremption prend le pas sur le stock —
                    // un produit périmé bien approvisionné reste un produit à
                    // retirer.
                    style={{
                      ['--rail' as string]:
                        expiry.state === 'ok' ? STOCK_RAIL[state] : EXPIRY_RAIL[expiry.state],
                    }}
                    className={cx(
                      'state-rail border-b border-surface-border last:border-0',
                      // Un lot périmé se distingue au premier coup d'œil : la
                      // ligne recule visuellement, comme un article déjà sorti
                      // du rayon.
                      expiry.state === 'expired' && 'bg-state-bad-soft/50 opacity-70',
                    )}
                  >
                    <td data-label="Produit" className="px-4 py-3 font-medium">
                      {product.name}
                      {expiry.state !== 'ok' ? (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={expiry.state === 'soon' ? 'warning' : 'danger'}>
                            <span aria-hidden="true">{EXPIRY_ICONS[expiry.state]}</span>{' '}
                            {EXPIRY_LABELS[expiry.state]}
                          </Badge>
                          {expiry.label ? (
                            <span className="text-xs font-normal text-ink-muted">
                              {expiry.label}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {product.variantAxes.length > 0 ? (
                        <p className="mt-0.5 text-xs font-normal text-ink-faint">
                          {activeVariants.length} déclinaison
                          {activeVariants.length > 1 ? 's' : ''} ·{' '}
                          {product.variantAxes.map((axis) => axis.name).join(' × ')}
                        </p>
                      ) : (
                        variant &&
                        Object.keys(variant.attributes).length > 0 && (
                          <p className="mt-0.5 text-xs font-normal text-ink-faint">
                            {Object.entries(variant.attributes)
                              .map(([key, value]) => `${key} : ${value}`)
                              .join(' · ')}
                          </p>
                        )
                      )}
                    </td>
                    {/* Sur téléphone la ligne devient une fiche empilée : une
                        catégorie ou une marque vide y ajouterait une ligne
                        « — » sans information. Masquée là, conservée en table
                        où les colonnes doivent rester alignées. */}
                    <td
                      data-label="Catégorie"
                      className={cx(
                        'px-4 py-3 text-ink-muted',
                        !product.category && 'max-md:hidden',
                      )}
                    >
                      {product.category?.name ?? '—'}
                    </td>
                    <td
                      data-label="Marque"
                      className={cx('px-4 py-3 text-ink-muted', !product.brand && 'max-md:hidden')}
                    >
                      {product.brand?.name ?? '—'}
                    </td>
                    <td data-label="Prix" className="px-4 py-3 text-right font-medium">
                      {variant ? formatMoney(variant.price, currency) : '—'}
                      {variant?.units.map((unit) => {
                        const label = unitLabelById.get(unit.unitId);
                        if (!label || unit.price === null) return null;
                        return (
                          <p key={unit.unitId} className="mt-0.5 text-xs font-normal text-ink-faint">
                            {label} ×{unit.factor} : {formatMoney(unit.price, currency)}
                          </p>
                        );
                      })}
                    </td>
                    <td
                      data-label="Stock"
                      className={cx(
                        'px-4 py-3 text-right tabular-nums',
                        state === 'low' && 'font-medium text-state-warn',
                        state === 'out' && 'font-medium text-state-bad',
                      )}
                    >
                      {/* Stock affiché dans les unités du produit — « 13 cartons
                          + 17 bouteilles ». Recalculé, jamais stocké ainsi. */}
                      {formatCompositeStock(stock, unitOptionsFor(product))}
                    </td>
                    <td data-label="Statut" className="px-4 py-3">
                      <Badge tone={STATUS_TONES[product.status]}>
                        {STATUS_LABELS[product.status]}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setWithdrawing(product)}>
                            Retirer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingProduct(product)}>
                            Modifier
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
          )}
        </>
      )}
    </div>
  );
}

function QuickAddForm({
  label,
  placeholder,
  endpoint,
  field,
  onDone,
  onCancel,
}: {
  label: string;
  placeholder: string;
  endpoint: string;
  field: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await api.post(endpoint, { [field]: String(formData.get(field) ?? '') });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        {error && (
          <p role="alert" className="w-full text-sm text-state-bad">
            {error}
          </p>
        )}
        <div className="min-w-56 flex-1">
          <Field label={label} htmlFor={field}>
            <input id={field} name={field} required className={inputClass} placeholder={placeholder} />
          </Field>
        </div>
        <Button type="submit" size="sm" loading={pending}>
          Ajouter
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </form>
    </Card>
  );
}

/**
 * Section repliée par défaut, pour ce qui ne concerne pas tout le monde.
 *
 * Le §10 le dit sans détour : le formulaire expose trop d'options et peut
 * créer de la confusion. Quatre encadrés « (facultatif) » étaient dépliés en
 * permanence — conditionnements, réapprovisionnement, attributs — et le
 * commerçant qui voulait simplement enregistrer un savon à 500 F devait les
 * traverser tous pour trouver le bouton d'enregistrement.
 *
 * Rien n'est retiré : ce qui servait sert toujours, mais se demande. La
 * section s'ouvre d'elle-même quand elle contient déjà quelque chose, sans
 * quoi une modification cacherait des données que le produit possède.
 */
function OptionalSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-surface-border [&[open]>summary]:border-b [&[open]>summary]:border-surface-border"
    >
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">{title}</span>
            <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-ink-faint">
            +
          </span>
        </span>
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
}

function ProductForm({
  product,
  categories,
  brands,
  storeUnits,
  currency,
  businessType,
  onDone,
  onCancel,
}: {
  /** Présent pour une modification, absent pour une création. */
  product?: Product;
  categories: Category[];
  brands: BrandRow[];
  storeUnits: StoreUnit[];
  currency: string;
  businessType: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(product);
  const variant = product?.variants[0];
  const mutation = useServerMutation();
  const pending = mutation.pending;
  const fieldErrors = mutation.fieldErrors;
  const [attr1Label, attr2Label] = attributeSuggestionsFor(businessType);
  /** Axes typiques du métier — proposés en un clic, jamais imposés. */
  const suggestedAxes = SECTOR_VARIANT_AXES[businessType] ?? [];

  const [baseUnitId, setBaseUnitId] = useState(product?.baseUnitId ?? storeUnits[0]?.id ?? '');
  const [unitDrafts, setUnitDrafts] = useState<UnitDraft[]>(() =>
    (variant?.units ?? []).map((unit) => ({
      key: newDraftKey(),
      unitId: unit.unitId,
      factor: String(unit.factor),
      price: unit.price === null ? '' : String(toMajor(unit.price, currency)),
      cost: unit.cost === null ? '' : String(toMajor(unit.cost, currency)),
    })),
  );

  // — Déclinaisons —
  const [axes, setAxes] = useState<VariantAxis[]>(product?.variantAxes ?? []);
  const [declinations, setDeclinations] = useState<DeclinationDraft[]>(() =>
    (product?.variants ?? [])
      .filter((v) => v.isActive)
      .map((v) => ({
        key: newDraftKey(),
        id: v.id,
        attributes: v.attributes,
        sku: v.sku ?? '',
        barcode: v.barcode ?? '',
        cost: String(toMajor(v.cost, currency)),
        price: String(toMajor(v.price, currency)),
        initialStock: '0',
      })),
  );
  const hasAxes = axes.length > 0;

  function updateAxis(index: number, patch: Partial<VariantAxis>) {
    setAxes((current) => current.map((axis, i) => (i === index ? { ...axis, ...patch } : axis)));
  }

  /**
   * Dresse la liste des versions à partir de ce qui varie.
   *
   * Se déclenche seule, dès qu'un critère est complet. Il fallait auparavant
   * appuyer sur « Générer les combinaisons » — un bouton qui ne produisait
   * rien de visible tant qu'on n'y pensait pas, et dont le nom n'apprenait à
   * personne ce qu'il ferait. Le §11 demande un aperçu des versions ; un
   * aperçu qui attend un clic n'en est pas un.
   *
   * Le travail déjà saisi est conservé — prix, référence, stock — et seules
   * les versions manquantes s'ajoutent : ajouter une taille n'efface pas les
   * prix des couleurs déjà remplies.
   */
  const usableAxes = axes.filter((axis) => axis.name.trim() && axis.values.length > 0);
  // Signature du contenu, et non des objets : un rendu qui recrée le tableau
  // `axes` à l'identique ne doit pas relancer le calcul.
  const axesSignature = JSON.stringify(
    usableAxes.map((axis) => [axis.name.trim(), axis.values]),
  );

  useEffect(() => {
    const usable: VariantAxis[] = JSON.parse(axesSignature).map(
      ([name, values]: [string, string[]]) => ({ name, values }),
    );
    if (usable.length === 0) return;

    setDeclinations((current) => {
      const byKey = new Map(current.map((draft) => [combinationKey(draft.attributes, usable), draft]));
      return buildCombinations(usable).map(
        (attributes) =>
          byKey.get(combinationKey(attributes, usable)) ?? {
            key: newDraftKey(),
            attributes,
            sku: '',
            barcode: '',
            cost: '',
            price: '',
            initialStock: '0',
          },
      );
    });
  }, [axesSignature]);

  function updateDeclination(key: string, patch: Partial<DeclinationDraft>) {
    setDeclinations((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
  }

  function removeDeclination(key: string) {
    setDeclinations((current) => current.filter((draft) => draft.key !== key));
  }

  const baseUnit = storeUnits.find((unit) => unit.id === baseUnitId) ?? null;
  // L'unité de base ne peut pas être aussi un conditionnement : sa conversion
  // vaut 1 par définition (voir `validateVariantUnits`).
  const availableUnits = storeUnits.filter((unit) => unit.id !== baseUnitId);

  function addUnitDraft() {
    const taken = new Set(unitDrafts.map((draft) => draft.unitId));
    const next = availableUnits.find((unit) => !taken.has(unit.id));
    if (!next) return;
    setUnitDrafts((current) => [
      ...current,
      {
        key: newDraftKey(),
        unitId: next.id,
        // Conversion habituelle de la boutique, si elle en a déclaré une
        // (Réglages → Secteur et unités). Simple gain de saisie : c'est la
        // valeur de cette fiche qui fera foi.
        factor: next.defaultFactor ? String(next.defaultFactor) : '',
        price: '',
        cost: '',
      },
    ]);
  }

  function updateUnitDraft(key: string, patch: Partial<UnitDraft>) {
    setUnitDrafts((current) =>
      current.map((draft) => {
        if (draft.key !== key) return draft;
        const next = { ...draft, ...patch };
        // Changer d'unité sur une ligne encore vierge reprend la conversion
        // habituelle de la nouvelle unité.
        if (patch.unitId && !draft.factor) {
          const unit = storeUnits.find((candidate) => candidate.id === patch.unitId);
          if (unit?.defaultFactor) next.factor = String(unit.defaultFactor);
        }
        return next;
      }),
    );
  }

  function removeUnitDraft(key: string) {
    setUnitDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  /** Conditionnements réellement saisis — une ligne sans conversion est ignorée. */
  const filledDrafts = unitDrafts.filter((draft) => Number(draft.factor) > 0);
  // Le plus grand conditionnement sert de saisie du stock initial (« 15
  // cartons »), converti en unité de base à l'envoi.
  const largestDraft = filledDrafts.reduce<UnitDraft | null>(
    (best, draft) => (!best || Number(draft.factor) > Number(best.factor) ? draft : best),
    null,
  );
  const largestUnit = largestDraft
    ? (storeUnits.find((unit) => unit.id === largestDraft.unitId) ?? null)
    : null;
  const largestFactor = largestDraft ? Number(largestDraft.factor) : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const categoryId = String(formData.get('categoryId') ?? '');
    const brandId = String(formData.get('brandId') ?? '');

    const attributes: Record<string, string> = {};
    const attr1Value = String(formData.get('attr1') ?? '').trim();
    const attr2Value = String(formData.get('attr2') ?? '').trim();
    if (attr1Value) attributes[attr1Label] = attr1Value;
    if (attr2Value) attributes[attr2Label] = attr2Value;

    // Chaque conditionnement porte son propre prix : jamais déduit du facteur,
    // un carton peut être vendu moins cher que son contenu à l'unité.
    const units = filledDrafts.map((draft) => ({
      unitId: draft.unitId,
      factor: Number(draft.factor),
      price: draft.price.trim() ? toMinor(draft.price, currency) : null,
      cost: draft.cost.trim() ? toMinor(draft.cost, currency) : null,
      isSellable: Boolean(draft.price.trim()),
      isPurchasable: true,
    }));

    // Axes réellement renseignés — une ligne vide laissée à l'écran ne doit
    // pas générer d'axe sans nom.
    const cleanAxes = axes
      .map((axis) => ({
        name: axis.name.trim(),
        values: axis.values.map((value) => value.trim()).filter(Boolean),
      }))
      .filter((axis) => axis.name && axis.values.length > 0);

    const cleanDeclinations = cleanAxes.length
      ? declinations.map((draft) => ({
          ...(draft.id ? { id: draft.id } : {}),
          attributes: draft.attributes,
          sku: draft.sku.trim() || undefined,
          barcode: draft.barcode.trim() || undefined,
          // Une déclinaison laissée sans prix hérite de celui de la fiche :
          // le cas courant, où seule la taille change, pas le tarif.
          cost: draft.cost.trim()
            ? toMinor(draft.cost, currency)
            : toMinor(String(formData.get('cost') ?? '0'), currency),
          price: draft.price.trim()
            ? toMinor(draft.price, currency)
            : toMinor(String(formData.get('price') ?? '0'), currency),
          isActive: true,
          initialStock: Number(draft.initialStock) || 0,
        }))
      : [];

    const shared = {
      name: String(formData.get('name') ?? ''),
      categoryId: categoryId || null,
      brandId: brandId || null,
      status: String(formData.get('status') ?? 'DRAFT'),
      minStockAlert: Number(formData.get('minStockAlert') ?? 0),
      maxStock: Number(formData.get('maxStock') ?? 0) || null,
      supplierLeadDays: Number(formData.get('supplierLeadDays') ?? 0) || null,
      unit: String(formData.get('unit') ?? 'UNIT'),
      sku: String(formData.get('sku') ?? '') || undefined,
      cost: toMinor(String(formData.get('cost') ?? '0'), currency),
      price: toMinor(String(formData.get('price') ?? '0'), currency),
      attributes,
      baseUnitId: baseUnitId || null,
      units,
      variantAxes: cleanAxes,
      variants: cleanDeclinations,
    };

    mutation.run(
      async () => {
      if (isEdit && product) {
        await api.patch(`/api/boutique/products/${product.id}`, shared);
      } else {
        // Le stock initial peut être saisi dans le plus grand conditionnement
        // (« 15 cartons + 3 bouteilles ») : converti ici en unité de base,
        // la seule dans laquelle le stock est enregistré.
        const packs = Number(formData.get('initialStockPacks') ?? 0);
        const extraUnits = Number(formData.get('initialStockUnits') ?? 0);
        const initialStock = largestFactor
          ? packs * largestFactor + extraUnits
          : Number(formData.get('initialStock') ?? 0);

        await api.post('/api/boutique/products', {
          ...shared,
          initialStock,
          initialStockExpiryDate: String(formData.get('initialStockExpiryDate') ?? '') || undefined,
        });
      }
      },
      {
        // Le parent affiche la confirmation et demande le nouveau rendu en
        // refermant le formulaire ; le redemander ici le ferait deux fois.
        skipRefresh: true,
        onSuccess: onDone,
        failureMessage: "L'enregistrement a échoué.",
      },
    );
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">{isEdit ? `Modifier « ${product!.name} »` : 'Nouveau produit'}</h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <AlertMessage message={mutation.error} />

        <Field label="Nom" htmlFor="name" required error={fieldErrors.name}>
          <input id="name" name="name" required className={inputClass} placeholder="T-shirt col rond" defaultValue={product?.name} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" className={inputClass} defaultValue={product?.category?.id ?? ''}>
              <option value="">Aucune</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marque" htmlFor="brandId">
            <select id="brandId" name="brandId" className={inputClass} defaultValue={product?.brand?.id ?? ''}>
              <option value="">Aucune</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Coût d'achat (${currency})`} htmlFor="cost" required error={fieldErrors.cost}>
            <input
              id="cost"
              name="cost"
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
              defaultValue={variant ? toMajor(variant.cost, currency) : '0'}
            />
          </Field>
          <Field label={`Prix de vente (${currency})`} htmlFor="price" required error={fieldErrors.price}>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
              defaultValue={variant ? toMajor(variant.price, currency) : undefined}
            />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-surface-border p-4">
          {/* Le §11 est explicite sur le vocabulaire : « déclinaison », « axe »,
              « valeurs », « générer les combinaisons » sont des mots de
              logiciel, pas des mots de commerçant. La section pose désormais
              une question et donne un exemple, plutôt que de nommer un
              concept. */}
          <legend className="px-1 text-sm font-medium">
            Ce produit existe en plusieurs versions ?
          </legend>
          <p className="text-xs text-ink-faint">
            Une version, c&apos;est le même produit décliné : le même tee-shirt en rouge et en
            bleu, la même huile en 1 L et en 5 L. Chaque version a son propre stock et peut avoir
            son propre prix. Laissez vide si votre produit n&apos;existe qu&apos;en une seule
            version.
          </p>

          {axes.length > 0 && (
            <ul className="mt-4 space-y-3">
              {axes.map((axis, index) => (
                <li key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-muted">
                      Qu&apos;est-ce qui change ?
                    </span>
                    <input
                      value={axis.name}
                      onChange={(event) => updateAxis(index, { name: event.target.value })}
                      placeholder="Taille"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-muted">
                      Les possibilités, séparées par une virgule
                    </span>
                    <input
                      defaultValue={axis.values.join(', ')}
                      onBlur={(event) =>
                        updateAxis(index, {
                          values: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="S, M, L, XL"
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setAxes((current) => current.filter((_, i) => i !== index))}
                    aria-label="Ne plus faire varier ce critère"
                    className="self-end px-2 pb-2.5 text-ink-faint hover:text-state-bad"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {axes.length === 0 && suggestedAxes.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setAxes(suggestedAxes.map((axis) => ({ ...axis })))}
              >
                Mon produit varie par {suggestedAxes.map((axis) => axis.name.toLowerCase()).join(' et ')}
              </Button>
            )}
            {axes.length < 3 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setAxes((current) => [...current, { name: '', values: [] }])}
              >
                + Autre chose qui change
              </Button>
            )}
          </div>

          {declinations.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-medium">Version</th>
                    <th className="py-2 pr-3 font-medium">Réf.</th>
                    <th className="py-2 pr-3 font-medium">Code-barres</th>
                    <th className="py-2 pr-3 font-medium">Prix</th>
                    {!isEdit && <th className="py-2 pr-3 font-medium">Stock</th>}
                    <th className="py-2 font-medium">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {declinations.map((draft) => (
                    <tr key={draft.key} className="border-b border-surface-border last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {Object.values(draft.attributes).filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={draft.sku}
                          onChange={(event) => updateDeclination(draft.key, { sku: event.target.value })}
                          className={cx(inputClass, 'w-28')}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={draft.barcode}
                            onChange={(event) =>
                              updateDeclination(draft.key, { barcode: event.target.value })
                            }
                            className={cx(inputClass, 'w-32')}
                          />
                          {/* Scanner l'étiquette évite de recopier treize
                              chiffres à la main, où une seule erreur rend
                              l'article introuvable en caisse. */}
                          <BarcodeScannerButton
                            size="sm"
                            iconOnly
                            label="Scanner le code-barres"
                            onDetect={(code) => updateDeclination(draft.key, { barcode: code })}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.price}
                          onChange={(event) =>
                            updateDeclination(draft.key, { price: event.target.value })
                          }
                          placeholder="prix fiche"
                          className={cx(inputClass, 'w-24')}
                        />
                      </td>
                      {!isEdit && (
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={draft.initialStock}
                            onChange={(event) =>
                              updateDeclination(draft.key, { initialStock: event.target.value })
                            }
                            className={cx(inputClass, 'w-20')}
                          />
                        </td>
                      )}
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeDeclination(draft.key)}
                          aria-label="Retirer cette version"
                          className="text-ink-faint hover:text-state-bad"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isEdit && (
                <p className="mt-2 text-xs text-ink-faint">
                  Le stock de chaque version se modifie depuis les entrées et sorties, pas ici.
                  Une version retirée est désactivée, jamais supprimée : les ventes déjà
                  enregistrées la mentionnent toujours.
                </p>
              )}
            </div>
          )}
        </fieldset>

        <OptionalSection
          title="Vendez-vous aussi par carton, sac ou paquet ?"
          hint="Pour acheter ou vendre en gros, avec un prix différent de l'unité."
          defaultOpen={unitDrafts.length > 0}
        >
          <p className="text-xs text-ink-faint">
            Le stock reste toujours compté en{' '}
            <strong>{baseUnit?.labelPlural ?? 'unités de base'}</strong> ; ces conditionnements
            servent à acheter, vendre et afficher. Chacun a son propre prix — un carton peut
            coûter moins cher que son contenu vendu à l&apos;unité.
          </p>

          {unitDrafts.length > 0 && (
            <ul className="mt-4 space-y-3">
              {unitDrafts.map((draft) => {
                const taken = new Set(
                  unitDrafts.filter((d) => d.key !== draft.key).map((d) => d.unitId),
                );
                const options = availableUnits.filter(
                  (unit) => unit.id === draft.unitId || !taken.has(unit.id),
                );
                return (
                  <li key={draft.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs text-ink-muted">Unité</span>
                      <select
                        value={draft.unitId}
                        onChange={(event) => updateUnitDraft(draft.key, { unitId: event.target.value })}
                        className={inputClass}
                      >
                        {options.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ink-muted">
                        Contient ({baseUnit?.labelPlural ?? 'unités'})
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="20"
                        value={draft.factor}
                        onChange={(event) => updateUnitDraft(draft.key, { factor: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ink-muted">Prix vente ({currency})</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(event) => updateUnitDraft(draft.key, { price: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ink-muted">Coût achat ({currency})</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.cost}
                        onChange={(event) => updateUnitDraft(draft.key, { cost: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeUnitDraft(draft.key)}
                      aria-label="Retirer ce conditionnement"
                      className="self-end px-2 pb-2.5 text-ink-faint hover:text-state-bad"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {availableUnits.length > unitDrafts.length ? (
            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={addUnitDraft}>
              + Ajouter un conditionnement
            </Button>
          ) : (
            availableUnits.length === 0 && (
              // Le §10 demande de prévoir discrètement « autre unité » pour
              // les cas particuliers. C'est possible — mais depuis les
              // réglages, et rien ici ne le disait : le commerçant restait
              // devant une phrase qui constate sans indiquer la sortie.
              <p className="mt-3 text-xs text-ink-faint">
                Aucune autre unité dans cette boutique.{' '}
                <Link
                  href="/boutique/dashboard/parametres"
                  className="underline underline-offset-4 hover:text-ink"
                >
                  En ajouter une
                </Link>{' '}
                — sac, carton, bidon, ou la vôtre.
              </p>
            )
          )}
        </OptionalSection>

        <OptionalSection
          title="Voulez-vous être prévenu avant la rupture ?"
          hint="Le délai de votre fournisseur sert à calculer quand recommander."
          defaultOpen={Boolean(product?.supplierLeadDays)}
        >
          <p className="text-xs text-ink-faint">
            Sert à prévoir les ruptures depuis vos ventes réelles, et à calculer la quantité à
            commander. Voir l&apos;écran <strong>Ruptures à venir</strong>.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label="Délai fournisseur (jours)"
              htmlFor="supplierLeadDays"
              hint="Temps entre la commande et la réception."
            >
              <input
                id="supplierLeadDays"
                name="supplierLeadDays"
                type="number"
                min="0"
                step="1"
                placeholder="2"
                className={inputClass}
                defaultValue={product?.supplierLeadDays ?? undefined}
              />
            </Field>
            <Field
              label={`Stock cible (${baseUnit?.labelPlural ?? 'unités'})`}
              htmlFor="maxStock"
              hint="Plafonne la quantité recommandée à la commande."
            >
              <input
                id="maxStock"
                name="maxStock"
                type="number"
                min="0"
                step="any"
                className={inputClass}
                defaultValue={product?.maxStock ?? undefined}
              />
            </Field>
          </div>
        </OptionalSection>

        {isEdit || hasAxes ? (
          <Field
            label="Seuil d'alerte stock bas"
            htmlFor="minStockAlert"
            hint={
              hasAxes && !isEdit
                ? 'Le stock initial se saisit par déclinaison, dans le tableau ci-dessus.'
                : undefined
            }
          >
            <input
              id="minStockAlert"
              name="minStockAlert"
              type="number"
              min="0"
              step="0.001"
              className={inputClass}
              defaultValue={product?.minStockAlert ?? 0}
            />
          </Field>
        ) : (
          <>
            {largestUnit && largestFactor > 0 ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label={`${largestUnit.labelPlural} en stock`}
                  htmlFor="initialStockPacks"
                  hint={`Chaque ${largestUnit.label} contient ${largestFactor} ${baseUnit?.labelPlural ?? ''}.`}
                >
                  <input
                    id="initialStockPacks"
                    name="initialStockPacks"
                    type="number"
                    min="0"
                    step="1"
                    className={inputClass}
                    defaultValue="0"
                  />
                </Field>
                <Field label={`${baseUnit?.labelPlural ?? 'Unités'} en plus`} htmlFor="initialStockUnits">
                  <input
                    id="initialStockUnits"
                    name="initialStockUnits"
                    type="number"
                    min="0"
                    step={baseUnit?.isDecimal ? '0.000001' : '1'}
                    className={inputClass}
                    defaultValue="0"
                  />
                </Field>
                <Field label="Seuil d'alerte stock bas" htmlFor="minStockAlert">
                  <input
                    id="minStockAlert"
                    name="minStockAlert"
                    type="number"
                    min="0"
                    step="0.001"
                    className={inputClass}
                    defaultValue="0"
                  />
                </Field>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Stock initial"
                  htmlFor="initialStock"
                  hint="Quantité déjà en votre possession. Décimale pour un produit vendu au poids/volume."
                >
                  <input
                    id="initialStock"
                    name="initialStock"
                    type="number"
                    min="0"
                    step="0.001"
                    className={inputClass}
                    defaultValue="0"
                  />
                </Field>
                <Field label="Seuil d'alerte stock bas" htmlFor="minStockAlert">
                  <input
                    id="minStockAlert"
                    name="minStockAlert"
                    type="number"
                    min="0"
                    step="0.001"
                    className={inputClass}
                    defaultValue="0"
                  />
                </Field>
              </div>
            )}

            <Field
              label="Date de péremption du stock initial (facultatif)"
              htmlFor="initialStockExpiryDate"
              hint="Pour les denrées ou cosmétiques — laisser vide sinon."
            >
              <input
                id="initialStockExpiryDate"
                name="initialStockExpiryDate"
                type="date"
                className={inputClass}
              />
            </Field>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référence / SKU (facultatif)" htmlFor="sku">
            <input id="sku" name="sku" className={inputClass} placeholder="TSH-001" defaultValue={variant?.sku ?? undefined} />
          </Field>
          <Field
            label="Unité de stock"
            htmlFor="baseUnitId"
            error={fieldErrors.baseUnitId}
            hint={
              isEdit
                ? "Non modifiable dès qu'un mouvement de stock existe."
                : 'La plus petite unité que vous vendez : la bouteille, le mètre, la pièce.'
            }
          >
            <select
              id="baseUnitId"
              name="baseUnitId"
              className={inputClass}
              value={baseUnitId}
              onChange={(event) => setBaseUnitId(event.target.value)}
            >
              {storeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Champ hérité : conservé pour le libellé du site public tant que
            celui-ci n'est pas passé au moteur d'unités. */}
        <input type="hidden" name="unit" value={product?.unit ?? 'UNIT'} />

        {/* Ces deux champs ne créent pas de versions : ils décrivent le
            produit, pour le retrouver et l'afficher. Leurs intitulés viennent
            du secteur de la boutique — « Matière » et « Origine » chez un
            épicier, « Marque » et « Modèle » chez un vendeur d'électronique. */}
        <OptionalSection
          title={`Préciser ${attr1Label.toLowerCase()} ou ${attr2Label.toLowerCase()} ?`}
          hint="Deux détails pour décrire ce produit. Facultatif."
          defaultOpen={Boolean(
            variant?.attributes[attr1Label] || variant?.attributes[attr2Label],
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={attr1Label} htmlFor="attr1">
              <input id="attr1" name="attr1" className={inputClass} defaultValue={variant?.attributes[attr1Label] ?? undefined} />
            </Field>
            <Field label={attr2Label} htmlFor="attr2">
              <input id="attr2" name="attr2" className={inputClass} defaultValue={variant?.attributes[attr2Label] ?? undefined} />
            </Field>
          </div>
        </OptionalSection>

        <Field label="Statut" htmlFor="status">
          <select id="status" name="status" className={inputClass} defaultValue={product?.status ?? 'DRAFT'}>
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Actif</option>
            {isEdit && <option value="ARCHIVED">Archivé</option>}
          </select>
        </Field>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
