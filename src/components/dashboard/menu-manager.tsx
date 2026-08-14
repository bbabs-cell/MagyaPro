'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  cx,
  inputClass,
} from '@/components/ui';
import { ImageUploadField } from '@/components/dashboard/image-upload';

/**
 * Gestion du menu : catégories et produits.
 *
 * Les prix sont saisis en unité majeure (« 3000 » ou « 12,50 ») et convertis en
 * unité mineure avant l'envoi, car c'est ainsi qu'ils sont persistés. La
 * conversion utilise le même module que le serveur, ce qui évite les écarts
 * d'arrondi entre l'affichage et l'enregistrement.
 */

type Category = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
};

type Variant = { name: string; price: number; isAvailable: boolean };
type OptionRow = { name: string; priceDelta: number; isAvailable: boolean };
type OptionGroup = {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: OptionRow[];
};

type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  isAvailable: boolean;
  badge: string;
  variants: Variant[];
  optionGroups: OptionGroup[];
};

const BADGES = [
  { value: 'NONE', label: 'Aucun' },
  { value: 'POPULAR', label: 'Populaire' },
  { value: 'NEW', label: 'Nouveau' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'SOLD_OUT', label: 'Épuisé' },
] as const;

export function MenuManager({
  initialCategories,
  initialProducts,
  currency,
  canManage,
  limits,
}: {
  initialCategories: Category[];
  initialProducts: Product[];
  currency: string;
  canManage: boolean;
  limits: { maxCategories?: number; maxProducts?: number };
}) {
  const router = useRouter();

  const [categories] = useState(initialCategories);
  const [products] = useState(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );

  const [categoryForm, setCategoryForm] = useState<Category | 'new' | null>(null);
  const [productForm, setProductForm] = useState<Product | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visibleProducts = selectedCategory
    ? products.filter((product) => product.categoryId === selectedCategory)
    : products;

  function handleError(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function toggleAvailability(product: Product) {
    setPendingId(product.id);
    setError(null);
    try {
      await api.patch(`/api/menu/produits/${product.id}`, {
        isAvailable: !product.isAvailable,
      });
      router.refresh();
    } catch (err) {
      handleError(err, "La disponibilité n'a pas pu être modifiée.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (
      !window.confirm(
        `Supprimer la catégorie « ${category.name} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }

    setPendingId(category.id);
    setError(null);
    try {
      await api.delete(`/api/menu/categories/${category.id}`);
      router.refresh();
    } catch (err) {
      handleError(err, "La catégorie n'a pas pu être supprimée.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteProduct(product: Product) {
    if (
      !window.confirm(
        `Supprimer « ${product.name} » ? Les commandes passées conservent le détail de ce plat.`,
      )
    ) {
      return;
    }

    setPendingId(product.id);
    setError(null);
    try {
      await api.delete(`/api/menu/produits/${product.id}`);
      router.refresh();
    } catch (err) {
      handleError(err, "Le plat n'a pas pu être supprimé.");
    } finally {
      setPendingId(null);
    }
  }

  if (categoryForm) {
    return (
      <CategoryForm
        category={categoryForm === 'new' ? null : categoryForm}
        onClose={() => setCategoryForm(null)}
        onSaved={() => {
          setCategoryForm(null);
          router.refresh();
        }}
      />
    );
  }

  if (productForm) {
    return (
      <ProductForm
        product={productForm === 'new' ? null : productForm}
        categories={categories}
        defaultCategoryId={selectedCategory}
        currency={currency}
        onClose={() => setProductForm(null)}
        onSaved={() => {
          setProductForm(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------- Catégories */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Catégories
            {limits.maxCategories !== undefined && limits.maxCategories > 0 && (
              <span className="ml-2 font-normal text-ink-faint">
                {categories.length} / {limits.maxCategories}
              </span>
            )}
          </h2>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setCategoryForm('new')}>
              Nouvelle catégorie
            </Button>
          )}
        </div>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Créez une première catégorie (Entrées, Plats, Boissons…) pour
            organiser votre carte.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  aria-pressed={selectedCategory === category.id}
                  className={cx(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    selectedCategory === category.id
                      ? 'bg-ink text-white'
                      : 'bg-surface-sunken text-ink-muted hover:text-ink',
                  )}
                >
                  {category.name}
                  <span className="ml-1.5 opacity-70">{category.productCount}</span>
                  {!category.isActive && (
                    <span className="ml-1.5 opacity-70">· masquée</span>
                  )}
                </button>

                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCategoryForm(category)}
                      className="rounded p-1 text-xs text-ink-faint hover:text-ink"
                    >
                      <span aria-hidden="true">✎</span>
                      <span className="sr-only">Modifier {category.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === category.id}
                      onClick={() => deleteCategory(category)}
                      className="rounded p-1 text-xs text-ink-faint hover:text-red-600 disabled:opacity-50"
                    >
                      <span aria-hidden="true">✕</span>
                      <span className="sr-only">Supprimer {category.name}</span>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------------------------------------------------- Produits */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Plats
            {limits.maxProducts !== undefined && limits.maxProducts > 0 && (
              <span className="ml-2 font-normal text-ink-faint">
                {products.length} / {limits.maxProducts}
              </span>
            )}
          </h2>
          {canManage && categories.length > 0 && (
            <Button size="sm" onClick={() => setProductForm('new')}>
              Nouveau plat
            </Button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Commencez par une catégorie"
              description="Les plats se rangent dans des catégories. Créez-en une pour ajouter votre premier plat."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setCategoryForm('new')}>
                    Créer une catégorie
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aucun plat dans cette catégorie"
              description="Ajoutez vos plats avec leur photo, leur prix et leurs options."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setProductForm('new')}>
                    Ajouter un plat
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-surface-border">
            {visibleProducts.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center gap-3 py-3">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image du tenant
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-14 w-14 shrink-0 rounded-xl bg-surface-sunken"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {product.name}
                    {product.badge !== 'NONE' && (
                      <Badge tone={product.badge === 'SOLD_OUT' ? 'danger' : 'brand'}>
                        {BADGES.find((badge) => badge.value === product.badge)?.label}
                      </Badge>
                    )}
                    {!product.isAvailable && <Badge tone="neutral">Indisponible</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {formatMoney(product.price, currency)}
                    {product.variants.length > 0 &&
                      ` · ${product.variants.length} variante${product.variants.length > 1 ? 's' : ''}`}
                    {product.optionGroups.length > 0 &&
                      ` · ${product.optionGroups.length} groupe${product.optionGroups.length > 1 ? 's' : ''} d'options`}
                  </p>
                </div>

                {canManage && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingId === product.id}
                      onClick={() => toggleAvailability(product)}
                    >
                      {product.isAvailable ? 'Marquer épuisé' : 'Remettre en vente'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setProductForm(product)}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === product.id}
                      onClick={() => deleteProduct(product)}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Formulaires

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      isActive: formData.get('isActive') === 'on',
    };

    try {
      if (category) {
        await api.patch(`/api/menu/categories/${category.id}`, payload);
      } else {
        await api.post('/api/menu/categories', payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La catégorie n'a pas pu être enregistrée.");
      }
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">
        {category ? `Modifier « ${category.name} »` : 'Nouvelle catégorie'}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Field label="Nom" htmlFor="name" required error={fieldErrors.name}>
          <input
            id="name"
            name="name"
            required
            defaultValue={category?.name ?? ''}
            className={inputClass}
            placeholder="Grillades"
          />
        </Field>

        <Field label="Description" htmlFor="description" error={fieldErrors.description}>
          <input
            id="description"
            name="description"
            defaultValue={category?.description ?? ''}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={category?.isActive ?? true}
            className="h-4 w-4 accent-ink"
          />
          Visible sur le site public
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProductForm({
  product,
  categories,
  defaultCategoryId,
  currency,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  defaultCategoryId: string | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [variants, setVariants] = useState<Variant[]>(product?.variants ?? []);
  const [groups, setGroups] = useState<OptionGroup[]>(product?.optionGroups ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const compareRaw = String(formData.get('compareAtPrice') ?? '').trim();
    const costRaw = String(formData.get('costPrice') ?? '').trim();

    const payload = {
      categoryId: String(formData.get('categoryId') ?? ''),
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      imageUrl,
      price: toMinor(String(formData.get('price') ?? '0'), currency),
      compareAtPrice: compareRaw ? toMinor(compareRaw, currency) : null,
      costPrice: costRaw ? toMinor(costRaw, currency) : null,
      isAvailable: formData.get('isAvailable') === 'on',
      badge: String(formData.get('badge') ?? 'NONE'),
      // Les lignes laissées vides par mégarde sont écartées plutôt que de
      // provoquer une erreur de validation peu compréhensible.
      variants: variants.filter((variant) => variant.name.trim() !== ''),
      optionGroups: groups
        .filter((group) => group.name.trim() !== '')
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => option.name.trim() !== ''),
        }))
        .filter((group) => group.options.length > 0),
    };

    try {
      if (product) {
        await api.patch(`/api/menu/produits/${product.id}`, payload);
      } else {
        await api.post('/api/menu/produits', payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Le plat n'a pas pu être enregistré.");
      }
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">
        {product ? `Modifier « ${product.name} »` : 'Nouveau plat'}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Field label="Catégorie" htmlFor="categoryId" required error={fieldErrors.categoryId}>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={product?.categoryId ?? defaultCategoryId ?? ''}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nom" htmlFor="name" required error={fieldErrors.name}>
          <input
            id="name"
            name="name"
            required
            defaultValue={product?.name ?? ''}
            className={inputClass}
          />
        </Field>

        <Field label="Description" htmlFor="description" error={fieldErrors.description}>
          <textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={product?.description ?? ''}
            className={inputClass}
          />
        </Field>

        <ImageUploadField
          label="Photo du plat"
          folder="products"
          value={imageUrl}
          hint="Format paysage recommandé. 5 Mo maximum."
          onChange={setImageUrl}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Prix (${currency})`} htmlFor="price" required error={fieldErrors.price}>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="any"
              required
              defaultValue={product ? toMajor(product.price, currency) : ''}
              className={inputClass}
            />
          </Field>

          <Field
            label={`Ancien prix (${currency})`}
            htmlFor="compareAtPrice"
            hint="Affiché barré. Laissez vide s'il n'y a pas de remise."
            error={fieldErrors.compareAtPrice}
          >
            <input
              id="compareAtPrice"
              name="compareAtPrice"
              type="number"
              min="0"
              step="any"
              defaultValue={
                product?.compareAtPrice ? toMajor(product.compareAtPrice, currency) : ''
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label={`Coût de revient (${currency})`}
          htmlFor="costPrice"
          hint="Facultatif — sert au calcul de marge dans Finances. Laissez vide si inconnu."
          error={fieldErrors.costPrice}
        >
          <input
            id="costPrice"
            name="costPrice"
            type="number"
            min="0"
            step="any"
            defaultValue={product?.costPrice ? toMajor(product.costPrice, currency) : ''}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Badge" htmlFor="badge">
            <select
              id="badge"
              name="badge"
              defaultValue={product?.badge ?? 'NONE'}
              className={inputClass}
            >
              {BADGES.map((badge) => (
                <option key={badge.value} value={badge.value}>
                  {badge.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-end gap-2.5 pb-2.5 text-sm">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={product?.isAvailable ?? true}
              className="h-4 w-4 accent-ink"
            />
            Disponible à la commande
          </label>
        </div>

        {/* ------------------------------------------------------- Variantes */}
        <fieldset className="rounded-xl border border-surface-border p-4">
          <legend className="px-1 text-sm font-medium">Variantes</legend>
          <p className="text-xs text-ink-muted">
            Tailles ou formats. Le prix d&apos;une variante remplace le prix de base.
          </p>

          <div className="mt-3 space-y-2">
            {variants.map((variant, index) => (
              <div key={index} className="flex flex-wrap gap-2">
                <input
                  aria-label={`Nom de la variante ${index + 1}`}
                  value={variant.name}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                  className={cx(inputClass, 'flex-1 min-w-40')}
                  placeholder="Grande"
                />
                <input
                  aria-label={`Prix de la variante ${index + 1}`}
                  type="number"
                  min="0"
                  step="any"
                  value={toMajor(variant.price, currency)}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((row, i) =>
                        i === index
                          ? { ...row, price: toMinor(event.target.value || '0', currency) }
                          : row,
                      ),
                    )
                  }
                  className={cx(inputClass, 'w-32')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setVariants((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Retirer
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() =>
              setVariants((current) => [
                ...current,
                { name: '', price: 0, isAvailable: true },
              ])
            }
          >
            Ajouter une variante
          </Button>
        </fieldset>

        {/* --------------------------------------------------------- Options */}
        <fieldset className="rounded-xl border border-surface-border p-4">
          <legend className="px-1 text-sm font-medium">Groupes d&apos;options</legend>
          <p className="text-xs text-ink-muted">
            Suppléments et accompagnements. Un supplément peut ajouter un montant
            au prix.
          </p>

          <div className="mt-3 space-y-4">
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="rounded-xl bg-surface-sunken p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 min-w-40 text-xs">
                    Nom du groupe
                    <input
                      value={group.name}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((row, i) =>
                            i === groupIndex ? { ...row, name: event.target.value } : row,
                          ),
                        )
                      }
                      className={cx(inputClass, 'mt-1')}
                      placeholder="Accompagnement"
                    />
                  </label>
                  <label className="text-xs">
                    Min
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={group.minSelect}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((row, i) =>
                            i === groupIndex
                              ? { ...row, minSelect: Number(event.target.value) }
                              : row,
                          ),
                        )
                      }
                      className={cx(inputClass, 'mt-1 w-20')}
                    />
                  </label>
                  <label className="text-xs">
                    Max
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={group.maxSelect}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((row, i) =>
                            i === groupIndex
                              ? { ...row, maxSelect: Number(event.target.value) }
                              : row,
                          ),
                        )
                      }
                      className={cx(inputClass, 'mt-1 w-20')}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setGroups((current) => current.filter((_, i) => i !== groupIndex))
                    }
                  >
                    Retirer le groupe
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {group.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex flex-wrap gap-2">
                      <input
                        aria-label={`Option ${optionIndex + 1} du groupe ${group.name || groupIndex + 1}`}
                        value={option.name}
                        onChange={(event) =>
                          setGroups((current) =>
                            current.map((row, i) =>
                              i === groupIndex
                                ? {
                                    ...row,
                                    options: row.options.map((opt, j) =>
                                      j === optionIndex
                                        ? { ...opt, name: event.target.value }
                                        : opt,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                        className={cx(inputClass, 'flex-1 min-w-40')}
                        placeholder="Attiéké"
                      />
                      <input
                        aria-label={`Supplément de l'option ${optionIndex + 1}`}
                        type="number"
                        step="any"
                        value={toMajor(option.priceDelta, currency)}
                        onChange={(event) =>
                          setGroups((current) =>
                            current.map((row, i) =>
                              i === groupIndex
                                ? {
                                    ...row,
                                    options: row.options.map((opt, j) =>
                                      j === optionIndex
                                        ? {
                                            ...opt,
                                            priceDelta: toMinor(
                                              event.target.value || '0',
                                              currency,
                                            ),
                                          }
                                        : opt,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                        className={cx(inputClass, 'w-32')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setGroups((current) =>
                            current.map((row, i) =>
                              i === groupIndex
                                ? {
                                    ...row,
                                    options: row.options.filter(
                                      (_, j) => j !== optionIndex,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setGroups((current) =>
                      current.map((row, i) =>
                        i === groupIndex
                          ? {
                              ...row,
                              options: [
                                ...row.options,
                                { name: '', priceDelta: 0, isAvailable: true },
                              ],
                            }
                          : row,
                      ),
                    )
                  }
                >
                  Ajouter une option
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() =>
              setGroups((current) => [
                ...current,
                {
                  name: '',
                  minSelect: 0,
                  maxSelect: 1,
                  options: [{ name: '', priceDelta: 0, isAvailable: true }],
                },
              ])
            }
          >
            Ajouter un groupe d&apos;options
          </Button>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
