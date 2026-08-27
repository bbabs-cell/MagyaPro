'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { formatCompositeStock, type UnitOption } from '@/lib/boutique/units';
import { Badge, Button, Card, EmptyState, Field, cx, inputClass } from '@/components/ui';

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
  attributes: Record<string, string>;
  units: VariantUnit[];
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  minStockAlert: number;
  unit: string;
  baseUnitId: string | null;
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

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'pièce(s)',
  KG: 'kg',
  GRAM: 'g',
  LITER: 'L',
  MILLILITER: 'mL',
  PACK: 'pack(s)',
};

/**
 * Libellés d'attributs suggérés selon le type de commerce de la boutique —
 * même mécanisme d'attributs libres (`attributes` en JSON) pour tous, mais
 * l'interface propose des exemples pertinents au métier plutôt que des
 * champs génériques « Attribut 1 / Attribut 2 ».
 */
const ATTRIBUTE_SUGGESTIONS: Record<string, [string, string]> = {
  CLOTHING: ['Taille', 'Couleur'],
  COSMETICS: ['Contenance', 'Teinte / Parfum'],
  ELECTRONICS: ['Numéro de série', 'Garantie'],
  GROCERY: ['Origine', 'Conservation'],
  MERCERIE: ['Couleur', 'Matière'],
  OTHER: ['Attribut 1', 'Attribut 2'],
};

export function ProductManager({
  initialCategories,
  initialBrands,
  initialProducts,
  storeUnits,
  currency,
  canManage,
  businessType,
}: {
  initialCategories: Category[];
  initialBrands: BrandRow[];
  initialProducts: Product[];
  /** Unités actives de la boutique — voir `StoreUnit`. */
  storeUnits: StoreUnit[];
  currency: string;
  canManage: boolean;
  businessType: string;
}) {
  const router = useRouter();
  const [categories] = useState(initialCategories);
  const [brands] = useState(initialBrands);
  const [products] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBrandForm, setShowBrandForm] = useState(false);

  function totalStock(product: Product): number {
    return product.variants.reduce(
      (sum, variant) =>
        sum + variant.inventory.reduce((vSum, inv) => vSum + inv.quantity, 0),
      0,
    );
  }

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
          onDone={() => {
            setShowCategoryForm(false);
            router.refresh();
          }}
          onCancel={() => setShowCategoryForm(false)}
        />
      )}

      {showBrandForm && (
        <QuickAddForm
          label="Nom de la marque"
          placeholder="Nike"
          endpoint="/api/boutique/brands"
          field="name"
          onDone={() => {
            setShowBrandForm(false);
            router.refresh();
          }}
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
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
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
          onDone={() => {
            setEditingProduct(null);
            router.refresh();
          }}
          onCancel={() => setEditingProduct(null)}
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
              {products.map((product) => {
                const variant = product.variants[0];
                const stock = totalStock(product);
                return (
                  <tr key={product.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Produit" className="px-4 py-3 font-medium">
                      {product.name}
                      {variant && Object.keys(variant.attributes).length > 0 && (
                        <p className="mt-0.5 text-xs font-normal text-ink-faint">
                          {Object.entries(variant.attributes)
                            .map(([key, value]) => `${key} : ${value}`)
                            .join(' · ')}
                        </p>
                      )}
                    </td>
                    <td data-label="Catégorie" className="px-4 py-3 text-ink-muted">
                      {product.category?.name ?? '—'}
                    </td>
                    <td data-label="Marque" className="px-4 py-3 text-ink-muted">
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
                        'px-4 py-3 text-right',
                        stock <= product.minStockAlert && 'font-medium text-amber-700',
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
                        <Button size="sm" variant="ghost" onClick={() => setEditingProduct(product)}>
                          Modifier
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
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
          <p role="alert" className="w-full text-sm text-red-600">
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attr1Label, attr2Label] = ATTRIBUTE_SUGGESTIONS[businessType] ?? ATTRIBUTE_SUGGESTIONS.OTHER!;

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
      { key: newDraftKey(), unitId: next.id, factor: '', price: '', cost: '' },
    ]);
  }

  function updateUnitDraft(key: string, patch: Partial<UnitDraft>) {
    setUnitDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

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

    const shared = {
      name: String(formData.get('name') ?? ''),
      categoryId: categoryId || null,
      brandId: brandId || null,
      status: String(formData.get('status') ?? 'DRAFT'),
      minStockAlert: Number(formData.get('minStockAlert') ?? 0),
      unit: String(formData.get('unit') ?? 'UNIT'),
      sku: String(formData.get('sku') ?? '') || undefined,
      cost: toMinor(String(formData.get('cost') ?? '0'), currency),
      price: toMinor(String(formData.get('price') ?? '0'), currency),
      attributes,
      baseUnitId: baseUnitId || null,
      units,
    };

    try {
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
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("L'enregistrement a échoué.");
      }
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">{isEdit ? `Modifier « ${product!.name} »` : 'Nouveau produit'}</h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

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
          <legend className="px-1 text-sm font-medium">Conditionnements (facultatif)</legend>
          <p className="text-xs text-ink-faint">
            Un carton, une palette, un rouleau… Le stock reste toujours compté en{' '}
            <strong>{baseUnit?.labelPlural ?? 'unités de base'}</strong> ; ces unités servent à
            acheter, vendre et afficher. Chaque conditionnement a son propre prix — un carton peut
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
                      className="self-end px-2 pb-2.5 text-ink-faint hover:text-red-600"
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
              <p className="mt-3 text-xs text-ink-faint">
                Aucune autre unité disponible dans cette boutique.
              </p>
            )
          )}
        </fieldset>

        {isEdit ? (
          <Field label="Seuil d'alerte stock bas" htmlFor="minStockAlert">
            <input
              id="minStockAlert"
              name="minStockAlert"
              type="number"
              min="0"
              step="0.001"
              className={inputClass}
              defaultValue={product!.minStockAlert}
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

        <fieldset>
          <legend className="text-sm font-medium">Attributs (facultatif)</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <Field label={attr1Label} htmlFor="attr1">
              <input id="attr1" name="attr1" className={inputClass} defaultValue={variant?.attributes[attr1Label] ?? undefined} />
            </Field>
            <Field label={attr2Label} htmlFor="attr2">
              <input id="attr2" name="attr2" className={inputClass} defaultValue={variant?.attributes[attr2Label] ?? undefined} />
            </Field>
          </div>
        </fieldset>

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
