'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMinor } from '@/lib/money';
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
type Variant = {
  id: string;
  sku: string | null;
  barcode: string | null;
  cost: number;
  price: number;
  attributes: Record<string, string>;
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  minStockAlert: number;
  unit: string;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  variants: Array<Variant & { inventory: Array<{ quantity: number; warehouseId: string }> }>;
};

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
  OTHER: ['Attribut 1', 'Attribut 2'],
};

export function ProductManager({
  initialCategories,
  initialBrands,
  initialProducts,
  currency,
  canManage,
  businessType,
}: {
  initialCategories: Category[];
  initialBrands: BrandRow[];
  initialProducts: Product[];
  currency: string;
  canManage: boolean;
  businessType: string;
}) {
  const router = useRouter();
  const [categories] = useState(initialCategories);
  const [brands] = useState(initialBrands);
  const [products] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBrandForm, setShowBrandForm] = useState(false);

  function totalStock(product: Product): number {
    return product.variants.reduce(
      (sum, variant) =>
        sum + variant.inventory.reduce((vSum, inv) => vSum + inv.quantity, 0),
      0,
    );
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
          currency={currency}
          businessType={businessType}
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={() => setShowForm(false)}
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
                    </td>
                    <td
                      data-label="Stock"
                      className={cx(
                        'px-4 py-3 text-right',
                        stock <= product.minStockAlert && 'font-medium text-amber-700',
                      )}
                    >
                      {stock} {product.unit !== 'UNIT' && UNIT_LABELS[product.unit]}
                    </td>
                    <td data-label="Statut" className="px-4 py-3">
                      <Badge tone={STATUS_TONES[product.status]}>
                        {STATUS_LABELS[product.status]}
                      </Badge>
                    </td>
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
  categories,
  brands,
  currency,
  businessType,
  onDone,
  onCancel,
}: {
  categories: Category[];
  brands: BrandRow[];
  currency: string;
  businessType: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attr1Label, attr2Label] = ATTRIBUTE_SUGGESTIONS[businessType] ?? ATTRIBUTE_SUGGESTIONS.OTHER!;

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

    try {
      await api.post('/api/boutique/products', {
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
        initialStock: Number(formData.get('initialStock') ?? 0),
        initialStockExpiryDate: String(formData.get('initialStockExpiryDate') ?? '') || undefined,
      });
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
      <h2 className="text-lg font-medium">Nouveau produit</h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Field label="Nom" htmlFor="name" required error={fieldErrors.name}>
          <input id="name" name="name" required className={inputClass} placeholder="T-shirt col rond" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" className={inputClass}>
              <option value="">Aucune</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marque" htmlFor="brandId">
            <select id="brandId" name="brandId" className={inputClass}>
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
              defaultValue="0"
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
            />
          </Field>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référence / SKU (facultatif)" htmlFor="sku">
            <input id="sku" name="sku" className={inputClass} placeholder="TSH-001" />
          </Field>
          <Field label="Unité" htmlFor="unit" hint="Détermine comment le stock s'affiche.">
            <select id="unit" name="unit" className={inputClass} defaultValue="UNIT">
              {Object.entries(UNIT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Attributs (facultatif)</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <Field label={attr1Label} htmlFor="attr1">
              <input id="attr1" name="attr1" className={inputClass} />
            </Field>
            <Field label={attr2Label} htmlFor="attr2">
              <input id="attr2" name="attr2" className={inputClass} />
            </Field>
          </div>
        </fieldset>

        <Field label="Statut" htmlFor="status">
          <select id="status" name="status" className={inputClass} defaultValue="DRAFT">
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Actif</option>
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
