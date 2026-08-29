'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney } from '@/lib/money';
import {
  UNIT_LABELS,
  STOCK_RAIL,
  STOCK_TONE,
  formatCompositeStock,
  quantityStep,
  stepForUnit,
  stockState,
  unitLabelFor,
  type UnitOption,
} from '@/lib/boutique/units';
import { enqueueSale } from '@/lib/boutique/offline-queue';
import { BarcodeScannerButton } from '@/components/boutique/barcode-scanner';
import {
  EXPIRY_ICONS,
  EXPIRY_LABELS,
  EXPIRY_RAIL,
  expiryLabel,
  expiryState,
} from '@/lib/boutique/expiry';
import { VoiceCommandButton, type VoiceResolution } from '@/components/boutique/voice-command';
import { matchByName, normalize, type VoiceIntent } from '@/lib/boutique/voice-grammar';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

/**
 * Caisse (POS).
 *
 * La recherche filtre côté client une liste déjà chargée : suffisant pour un
 * catalogue de quelques centaines de références, à revoir (recherche
 * serveur paginée) si un commerce dépasse cette taille.
 *
 * Un scanner code-barres USB/Bluetooth se comporte comme un clavier : il
 * tape les chiffres puis Entrée. La recherche les reconnaît — une
 * correspondance exacte sur `barcode` ajoute directement l'article au
 * panier plutôt que de simplement filtrer la liste.
 */

type VariantAxis = { name: string; values: string[] };

/** Une déclinaison concrète — c'est elle qui porte le stock et le prix. */
type Variant = {
  variantId: string;
  /** Une valeur par axe : `{ "Taille": "M", "Couleur": "Noir" }`. */
  attributes: Record<string, string>;
  barcode: string | null;
  price: number;
  /** Lot le plus proche de sa péremption, en ISO. `null` si aucun lot suivi. */
  expiryDate?: string | null;
  /** TOUJOURS en unité de base — la conversion se fait ici, à l'affichage
   *  et à l'ajout au panier. */
  stock: number;
  /**
   * Unités vendables, la base en premier (voir `resolveVariantUnitsBulk`).
   * Vide pour une fiche pas encore reprise par le moteur d'unités : la caisse
   * retombe alors sur le prix de la variante.
   */
  units: UnitOption[];
};

type Product = {
  id: string;
  name: string;
  unit: string;
  /** Vide pour un produit sans déclinaison — le cas courant. */
  axes: VariantAxis[];
  variants: Variant[];
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
  creditLimit: number;
};

type CartLine = {
  variantId: string;
  /** Unité choisie — deux lignes du même produit peuvent coexister dans le
   *  panier, une par unité (3 bouteilles + 1 carton). */
  unitId: string | null;
  unitLabel: string;
  unitLabelPlural: string;
  /** Unités de base contenues dans une unité de cette ligne. */
  factor: number;
  step: number;
  name: string;
  unitPrice: number;
  /** Quantité exprimée dans l'unité de la ligne, pas en unité de base. */
  quantity: number;
  /** Plafond, exprimé lui aussi dans l'unité de la ligne. */
  maxStock: number;
  unit: string;
};

/** Clé d'identité d'une ligne : un produit peut figurer plusieurs fois, une fois par unité. */
function lineKey(variantId: string, unitId: string | null): string {
  return `${variantId}:${unitId ?? 'base'}`;
}

type PaymentLine = { method: string; amount: string };
type PaymentMethodOption = { value: string; label: string };

export function Pos({
  storeId,
  products,
  customers,
  currency,
  taxEnabled,
  taxRate,
  paymentMethods,
  readOnly = false,
  now,
}: {
  storeId: string;
  products: Product[];
  customers: Customer[];
  currency: string;
  /** TVA de la boutique — voir `Store.taxEnabled`/`taxRate` (dixièmes de %). */
  taxEnabled: boolean;
  taxRate: number;
  /** Moyens de paiement actifs de la boutique — voir `payment-methods.ts`. */
  paymentMethods: PaymentMethodOption[];
  /**
   * Visite guidée d'une boutique de démonstration (voir `getDemoTourContext`) :
   * le panier reste explorable, mais l'encaissement est bloqué avant même
   * d'appeler l'API — qui le refuserait de toute façon côté serveur.
   */
  readOnly?: boolean;
  /** Instant de référence figé par le serveur — voir la page Caisse. */
  now: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([
    { method: paymentMethods[0]?.value ?? 'cash', amount: '' },
  ]);
  const [customerId, setCustomerId] = useState('');
  /** Valeur retenue par axe, pour chaque produit à déclinaisons. */
  const [selection, setSelection] = useState<Record<string, Record<string, string>>>({});
  const [promoCode, setPromoCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ number: number; total: number } | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  /**
   * Panier ouvert en feuille sur téléphone. Sur grand écran il occupe sa
   * colonne et cet état est ignoré.
   */
  const [cartOpen, setCartOpen] = useState(false);
  /**
   * Dernier produit ajouté — sert uniquement au retour visuel. Sans lui, sur
   * téléphone, cliquer sur un prix ne produisait aucun changement visible :
   * le panier étant hors écran, le vendeur ne savait pas si son geste avait
   * été pris en compte.
   */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.variants.some((variant) => variant.barcode?.toLowerCase() === needle),
    );
  }, [products, query]);

  /**
   * Déclinaison retenue pour un produit. Sans axe, il n'y en a qu'une. Avec
   * axes, tant que le caissier n'a pas choisi une valeur sur chaque axe, il
   * n'y a pas de déclinaison — donc rien à ajouter au panier.
   */
  function selectedVariant(product: Product): Variant | null {
    if (product.axes.length === 0) return product.variants[0] ?? null;
    const chosen = selection[product.id] ?? {};
    if (!product.axes.every((axis) => chosen[axis.name])) return null;
    return (
      product.variants.find((variant) =>
        product.axes.every((axis) => variant.attributes[axis.name] === chosen[axis.name]),
      ) ?? null
    );
  }

  function chooseAxisValue(productId: string, axisName: string, value: string) {
    setSelection((current) => {
      const chosen = current[productId] ?? {};
      // Recliquer sur la pastille active la désélectionne — plus rapide que
      // de chercher un bouton « effacer » entre deux clients.
      const next = chosen[axisName] === value ? undefined : value;
      return {
        ...current,
        [productId]: { ...chosen, [axisName]: next ?? '' },
      };
    });
  }

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const taxableAmount = subtotal - discountAmount;
  // Estimation : le code promo, lui, n'est vérifié et chiffré que côté serveur.
  const taxAmount = taxEnabled ? Math.round((taxableAmount * taxRate) / 1000) : 0;
  const total = taxableAmount + taxAmount;

  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(total - paymentsTotal, 0);
  const customer = customers.find((c) => c.id === customerId) ?? null;

  /**
   * `amount` : nombre d'unités à ajouter, dans l'unité de la ligne. Absent,
   * on ajoute un pas — le clic sur une pastille. Renseigné par la commande
   * vocale, qui dit « trois bouteilles » d'un coup.
   */
  function addToCart(product: Product, variant: Variant, option?: UnitOption, amount?: number) {
    setError(null);

    // Fiche pas encore reprise par le moteur d'unités : on vend à l'unité de
    // la fiche, exactement comme avant.
    const unit = option ?? variant.units.find((candidate) => candidate.isBase) ?? null;
    const factor = unit?.factor ?? 1;
    const unitPrice = unit?.price ?? variant.price;
    const step = unit ? stepForUnit(unit) : quantityStep(product.unit);

    // Le stock est compté en unité de base : converti ici en nombre d'unités
    // entières disponibles pour cette ligne (277 bouteilles → 13 cartons).
    const maxStock = unit && !unit.isBase ? Math.floor(variant.stock / factor) : variant.stock;

    const key = lineKey(variant.variantId, unit?.unitId ?? null);
    const label = unit?.label ?? '';
    const declination = product.axes
      .map((axis) => variant.attributes[axis.name])
      .filter(Boolean)
      .join(' · ');

    const name = [
      product.name,
      declination && `(${declination})`,
      unit && !unit.isBase && `— ${unit.label} ×${factor}`,
    ]
      .filter(Boolean)
      .join(' ');

    const added = amount && amount > 0 ? amount : step;

    // Retour immédiat : la carte s'allume brièvement et l'appareil vibre.
    // Une confirmation de 900 ms suffit à rassurer sans retarder la vente
    // suivante — le vendeur enchaîne souvent trois articles en cinq secondes.
    setJustAdded(product.id);
    navigator.vibrate?.(10);
    window.setTimeout(() => setJustAdded((id) => (id === product.id ? null : id)), 900);

    setCart((current) => {
      const existing = current.find((line) => lineKey(line.variantId, line.unitId) === key);
      if (existing) {
        if (existing.quantity >= maxStock) return current;
        return current.map((line) =>
          lineKey(line.variantId, line.unitId) === key
            ? { ...line, quantity: Math.min(line.quantity + added, line.maxStock) }
            : line,
        );
      }
      if (maxStock <= 0) return current;
      return [
        ...current,
        {
          variantId: variant.variantId,
          unitId: unit?.unitId ?? null,
          unitLabel: label,
          unitLabelPlural: unit?.labelPlural ?? label,
          factor,
          step,
          name,
          unitPrice,
          quantity: Math.min(added, maxStock),
          maxStock,
          unit: product.unit,
        },
      ];
    });
  }

  /**
   * Tente d'ajouter au panier l'article portant exactement ce code-barres.
   * Renvoie `true` si un article a été trouvé — que la vente ait pu se faire
   * ou non (une rupture de stock est signalée, pas ignorée).
   *
   * Partagé par les trois façons de scanner : douchette USB/Bluetooth (qui
   * tape le code puis Entrée), caméra, et saisie manuelle. Une seule logique
   * pour les trois, donc un seul comportement à comprendre.
   */
  function submitBarcode(code: string): boolean {
    const needle = code.trim().toLowerCase();
    if (!needle) return false;

    // Le code-barres identifie une déclinaison précise (un t-shirt en M noir),
    // pas seulement un produit : le scan ajoute donc directement la bonne.
    for (const product of products) {
      const variant = product.variants.find((v) => v.barcode?.toLowerCase() === needle);
      if (!variant) continue;
      if (variant.stock <= 0) {
        setError(`${product.name} : rupture de stock.`);
        return true;
      }
      setError(null);
      addToCart(product, variant);
      setQuery('');
      return true;
    }
    return false;
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    if (submitBarcode(query)) event.preventDefault();
  }

  function handleScan(code: string) {
    // Un code inconnu est reporté tel quel dans la recherche : le produit
    // existe peut-être sans code-barres enregistré, et le vendeur peut alors
    // le retrouver par son nom sans ressaisir quoi que ce soit.
    if (submitBarcode(code)) return;
    setQuery(code);
    setError(`Aucun produit avec le code-barres ${code}.`);
  }

  function updateQuantity(key: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          lineKey(line.variantId, line.unitId) === key
            ? { ...line, quantity: Math.max(line.step, Math.min(quantity, line.maxStock)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => lineKey(line.variantId, line.unitId) !== key));
  }

  function addPaymentLine() {
    const usedMethods = new Set(payments.map((p) => p.method));
    const nextMethod =
      paymentMethods.find((m) => !usedMethods.has(m.value))?.value ??
      paymentMethods[0]?.value ??
      'cash';
    setPayments((current) => [...current, { method: nextMethod, amount: String(remaining || '') }]);
  }

  function updatePaymentLine(index: number, patch: Partial<PaymentLine>) {
    setPayments((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removePaymentLine(index: number) {
    setPayments((current) => current.filter((_, i) => i !== index));
  }

  async function checkout() {
    if (cart.length === 0) return;
    if (readOnly) {
      setError('Encaissement désactivé en mode démonstration — explorez librement le panier et le catalogue.');
      return;
    }
    setPending(true);
    setError(null);
    setLastReceipt(null);
    setQueuedOffline(false);

    const payload = {
      // La quantité part dans l'unité de la ligne ; le serveur relit le
      // facteur depuis la fiche produit et convertit lui-même — jamais de
      // facteur ni de prix envoyés par la caisse.
      items: cart.map((line) => ({
        productVariantId: line.variantId,
        quantity: line.quantity,
        ...(line.unitId ? { unitId: line.unitId } : {}),
      })),
      customerId: customerId || undefined,
      discount: discountAmount,
      promoCode: promoCode.trim() || undefined,
      payments: payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount) })),
    };

    function resetCart() {
      setCart([]);
      setDiscount('');
      setPromoCode('');
      setPayments([{ method: paymentMethods[0]?.value ?? 'cash', amount: '' }]);
    }

    try {
      const { sale } = await api.post<{ sale: { number: number; total: number } }>(
        '/api/boutique/sales',
        payload,
      );
      setLastReceipt({ number: sale.number, total: sale.total });
      resetCart();
      router.refresh();
    } catch (err) {
      // Panne réseau : la vente est mise en attente localement plutôt que
      // perdue — voir `offline-queue.ts`. Toute autre erreur (stock
      // insuffisant, client invalide...) reste affichée immédiatement, elle
      // n'a rien à voir avec la connexion.
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
        enqueueSale(storeId, payload);
        setQueuedOffline(true);
        resetCart();
      } else {
        setError(err instanceof ApiError ? err.message : "La vente n'a pas pu être enregistrée.");
      }
    } finally {
      setPending(false);
    }
  }

  const canCheckout = cart.length > 0 && (remaining === 0 || Boolean(customer));
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  // --- Commandes vocales ----------------------------------------------------
  //
  // La grammaire (voir `voice-grammar.ts`) ne connaît que les mots ; c'est
  // ici, où le catalogue et le panier sont connus, que l'intention devient
  // une action précise — ou un refus explicite.

  /** Retrouve produit, déclinaison et unité correspondant aux mots prononcés. */
  function resolveVoiceTarget(
    query: string,
    unitWord: string | null,
  ): { product: Product; variant: Variant; unit: UnitOption | undefined } | null {
    const product = matchByName(products, query);
    if (!product) return null;

    // La première déclinaison encore en stock : dire « ajoute une chemise »
    // sans préciser la taille ne doit pas ajouter une taille en rupture.
    const variant =
      product.variants.find((candidate) => candidate.stock > 0) ?? product.variants[0];
    if (!variant) return null;

    if (!unitWord) return { product, variant, unit: undefined };
    const unit = variant.units.find((candidate) =>
      normalize(candidate.label).startsWith(unitWord),
    );
    return unit ? { product, variant, unit } : null;
  }

  function describeVoiceIntent(intent: VoiceIntent): VoiceResolution {
    switch (intent.kind) {
      case 'add': {
        const target = resolveVoiceTarget(intent.query, intent.unitWord);
        if (!target) {
          return {
            error: intent.unitWord
              ? `Aucun produit « ${intent.query} » vendu en ${intent.unitWord}.`
              : `Aucun produit ne correspond à « ${intent.query} ».`,
          };
        }
        if (target.variant.stock <= 0) return { error: `${target.product.name} : rupture de stock.` };
        const resolved = target.unit ?? target.variant.units.find((candidate) => candidate.isBase);
        const unitLabel = resolved
          ? unitLabelFor(resolved, intent.quantity)
          : (UNIT_LABELS[target.product.unit] ?? '');
        return { label: `${intent.quantity} × ${target.product.name} (${unitLabel}) ajouté au panier.` };
      }
      case 'remove': {
        const line = matchByName(cart, intent.query);
        if (!line) return { error: `Aucune ligne « ${intent.query} » dans le panier.` };
        return { label: `Retirer « ${line.name} » du panier ?` };
      }
      case 'clear':
        if (cart.length === 0) return { error: 'Le panier est déjà vide.' };
        return { label: `Vider le panier (${cart.length} ligne${cart.length > 1 ? 's' : ''}) ?` };
      case 'checkout':
        if (cart.length === 0) return { error: 'Le panier est vide.' };
        if (!canCheckout) {
          return { error: 'Le règlement est incomplet : ajoutez un paiement ou choisissez un client.' };
        }
        return { label: `Encaisser ${formatMoney(total, currency)} ?` };
      case 'search':
        return { label: `Recherche : ${intent.query}` };
      default:
        return { error: 'Commande non reconnue.' };
    }
  }

  function executeVoiceIntent(intent: VoiceIntent) {
    switch (intent.kind) {
      case 'add': {
        const target = resolveVoiceTarget(intent.query, intent.unitWord);
        if (target) addToCart(target.product, target.variant, target.unit, intent.quantity);
        return;
      }
      case 'remove': {
        const line = matchByName(cart, intent.query);
        if (line) removeLine(lineKey(line.variantId, line.unitId));
        return;
      }
      case 'clear':
        setCart([]);
        return;
      case 'checkout':
        void checkout();
        return;
      case 'search':
        setQuery(intent.query);
        return;
      default:
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* `pb-24` réserve la hauteur de la barre fixe : une barre en
          `position: fixed` sort du flux et masquerait sinon la dernière
          carte de la liste. */}
      <div className="max-lg:pb-24">
        <div className="mb-4 flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Rechercher un produit ou scanner un code-barres…"
            className={cx(inputClass, 'flex-1')}
            autoFocus
          />
          <BarcodeScannerButton onDetect={handleScan} className="shrink-0" />
        </div>

        <VoiceCommandButton
          describe={describeVoiceIntent}
          execute={executeVoiceIntent}
          className="mb-4"
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun produit ne correspond à cette recherche.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const variant = selectedVariant(product);
              const chosen = selection[product.id] ?? {};
              // Stock affiché dans les unités du produit : « 13 cartons +
              // 17 bouteilles » plutôt que « 277 ». Purement décoratif, le
              // stock reste compté en unité de base.
              const stockLabel = variant
                ? variant.units.length > 0
                  ? formatCompositeStock(variant.stock, variant.units)
                  : `${variant.stock} ${UNIT_LABELS[product.unit] ?? ''}`.trim()
                : null;
              // Sans déclinaison choisie, l'état porte sur le produit entier :
              // il reste vendable tant qu'une seule déclinaison a du stock.
              const state = stockState(
                variant ? variant.stock : product.variants.reduce((sum, v) => sum + v.stock, 0),
              );
              // Péremption de la déclinaison choisie, ou de la plus urgente
              // tant qu'aucune n'est choisie.
              const expiryDate = variant
                ? (variant.expiryDate ?? null)
                : product.variants.reduce<string | null>(
                    (soonest, v) =>
                      v.expiryDate && (!soonest || v.expiryDate < soonest) ? v.expiryDate : soonest,
                    null,
                  );
              const expiry = expiryState(expiryDate, now);

              return (
                <div
                  key={product.id}
                  // Rail coloré à gauche : l'état du stock se lit à la
                  // couleur avant même d'être lu au texte. La péremption
                  // prend le pas — un article périmé ne doit pas être
                  // encaissé, même s'il en reste en rayon.
                  style={{
                    ['--rail' as string]:
                      expiry === 'ok' ? STOCK_RAIL[state] : EXPIRY_RAIL[expiry],
                  }}
                  className={cx(
                    'card card-interactive state-rail flex flex-col items-start gap-1 p-4 pl-5 text-left',
                    'transition-shadow duration-200',
                    expiry === 'expired' && 'bg-state-bad-soft/50 opacity-70',
                    justAdded === product.id && 'ring-2 ring-brand',
                  )}
                >
                  <span className="font-medium text-ink">{product.name}</span>

                  {expiry !== 'ok' ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={expiry === 'soon' ? 'warning' : 'danger'}>
                        <span aria-hidden="true">{EXPIRY_ICONS[expiry]}</span>{' '}
                        {EXPIRY_LABELS[expiry]}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        {expiryLabel(expiryDate, now)}
                      </span>
                    </span>
                  ) : null}

                  {product.axes.map((axis) => (
                    <div key={axis.name} className="mt-1.5 w-full">
                      <span className="block text-xs text-ink-faint">{axis.name}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {axis.values.map((value) => {
                          const active = chosen[axis.name] === value;
                          // Une valeur dont aucune déclinaison n'a de stock
                          // reste visible mais grisée : le caissier voit que
                          // la taille existe et qu'elle est épuisée, plutôt
                          // que de la croire inexistante.
                          const inStock = product.variants.some(
                            (v) => v.attributes[axis.name] === value && v.stock > 0,
                          );
                          return (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => chooseAxisValue(product.id, axis.name, value)}
                              className={cx(
                                'rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
                                active
                                  ? 'border-ink bg-ink text-white'
                                  : 'border-surface-border text-ink hover:bg-surface-sunken',
                                !inStock && !active && 'opacity-40',
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {variant ? (
                    <>
                      <span className="mt-1.5">
                        <Badge tone={STOCK_TONE[state]}>
                          {variant.stock > 0 ? `${stockLabel} en stock` : 'Rupture'}
                        </Badge>
                      </span>

                      <div className="mt-1.5 flex w-full flex-wrap gap-1.5">
                        {variant.units.length > 0 ? (
                          variant.units.map((unit) => (
                            <button
                              key={unit.unitId}
                              type="button"
                              onClick={() => addToCart(product, variant, unit)}
                              disabled={variant.stock < unit.factor}
                              className="min-w-[46%] flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {unit.isBase ? unit.label : `${unit.label} ×${unit.factor}`}
                              <br />
                              {unit.price === null ? '—' : formatMoney(unit.price, currency)}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(product, variant)}
                            disabled={variant.stock <= 0}
                            className="flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {UNIT_LABELS[product.unit] ?? 'Unité'}
                            <br />
                            {formatMoney(variant.price, currency)}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-ink-faint">
                      Choisissez {product.axes.map((axis) => axis.name.toLowerCase()).join(' et ')}{' '}
                      pour ajouter au panier.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voile derrière la feuille : un appui à côté referme, geste attendu
          sur téléphone. Absent sur grand écran, où le panier vit dans sa
          propre colonne et n'a rien à recouvrir. */}
      {cartOpen ? (
        <button
          type="button"
          aria-label="Fermer le panier"
          onClick={() => setCartOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <Card
        className={cx(
          'h-fit p-4 sm:p-5',
          // Sur téléphone, le panier devient une feuille ancrée en bas plutôt
          // qu'un bloc rejeté sous une liste de cent produits. `pb-[calc(...)]`
          // dégage la barre de gestes Android, sans quoi le bouton d'encaissement
          // tombe dessous et devient difficile à viser.
          'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[85vh]',
          'max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-b-none',
          'max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]',
          !cartOpen && 'max-lg:hidden',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">Panier</h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="-mr-2 rounded-lg px-3 py-2 text-sm text-ink-muted lg:hidden"
            style={{ touchAction: 'manipulation' }}
          >
            Fermer
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-state-bad-soft px-4 py-3 text-sm text-state-bad">
            {error}
          </div>
        )}

        {lastReceipt && (
          <div role="status" className="mt-3 rounded-xl bg-state-ok-soft px-4 py-3 text-sm text-state-ok">
            Vente n°{lastReceipt.number} enregistrée — {formatMoney(lastReceipt.total, currency)}
          </div>
        )}

        {queuedOffline && (
          <div role="status" className="mt-3 rounded-xl bg-state-warn-soft px-4 py-3 text-sm text-state-warn">
            Pas de connexion — vente enregistrée localement, elle sera envoyée automatiquement dès le
            retour du réseau.
          </div>
        )}

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Ajoutez des produits pour commencer une vente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cart.map((line) => {
              const key = lineKey(line.variantId, line.unitId);
              const label = line.unitLabel
                ? unitLabelFor({ label: line.unitLabel, labelPlural: line.unitLabelPlural }, line.quantity)
                : (UNIT_LABELS[line.unit] ?? '');

              return (
                <li key={key} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatMoney(line.unitPrice, currency)}
                      {label && ` / ${line.unitLabel}`}
                    </p>
                  </div>
                  {/* Moins / champ / plus. Les flèches natives d'un champ
                      numérique font quelques pixels de haut : impossibles à
                      viser au doigt. Ces boutons font 44 px, au-dessus du
                      minimum recommandé sur Android. */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(key, line.quantity - line.step)}
                      aria-label={`Retirer une unité de ${line.name}`}
                      style={{ touchAction: 'manipulation' }}
                      className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={line.step}
                      max={line.maxStock}
                      step={line.step}
                      value={line.quantity}
                      onChange={(event) => updateQuantity(key, Number(event.target.value))}
                      aria-label={`Quantité de ${line.name}`}
                      className="h-11 w-14 rounded-lg border border-surface-border px-1 text-center text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(key, line.quantity + line.step)}
                      disabled={line.quantity >= line.maxStock}
                      aria-label={`Ajouter une unité de ${line.name}`}
                      style={{ touchAction: 'manipulation' }}
                      className="h-11 w-11 rounded-lg border border-surface-border text-lg leading-none text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="shrink-0 truncate text-xs text-ink-faint">{label}</span>
                  <button
                    type="button"
                    onClick={() => removeLine(key)}
                    aria-label={`Supprimer ${line.name} du panier`}
                    style={{ touchAction: 'manipulation' }}
                    className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-state-bad-soft hover:text-state-bad"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4">
          <label htmlFor="discount" className="block text-sm font-medium text-ink">
            Remise (montant)
          </label>
          <input
            id="discount"
            type="number"
            min={0}
            max={subtotal}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            placeholder="0"
            className={cx(inputClass, 'mt-1.5')}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="promoCode" className="block text-sm font-medium text-ink">
            Code promo (facultatif)
          </label>
          <input
            id="promoCode"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            placeholder="SOLDES20"
            className={cx(inputClass, 'mt-1.5 font-mono uppercase')}
          />
        </div>

        <div className="mt-4 space-y-1 border-t border-surface-border pt-4 text-sm">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Sous-total</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>Remise</span>
              <span>−{formatMoney(discountAmount, currency)}</span>
            </div>
          )}
          {taxEnabled && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>TVA ({(taxRate / 10).toLocaleString('fr-FR')} %)</span>
              <span>{formatMoney(taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        {customers.length > 0 && (
          <div className="mt-4">
            <label htmlFor="customerId" className="block text-sm font-medium text-ink">
              Client (facultatif)
            </label>
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={cx(inputClass, 'mt-1.5')}
            >
              <option value="">Aucun</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Paiement</p>
          <div className="mt-1.5 space-y-2">
            {payments.map((line, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={line.method}
                  onChange={(event) => updatePaymentLine(index, { method: event.target.value })}
                  className={cx(inputClass, 'flex-1')}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={line.amount}
                  onChange={(event) => updatePaymentLine(index, { amount: event.target.value })}
                  placeholder="0"
                  className={cx(inputClass, 'w-28')}
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePaymentLine(index)}
                    aria-label="Retirer ce paiement"
                    className="shrink-0 text-ink-faint hover:text-state-bad"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {payments.length < paymentMethods.length && (
            <button
              type="button"
              onClick={addPaymentLine}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              + Scinder le paiement
            </button>
          )}

          {remaining > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              {customer ? (
                <>
                  Reste à crédit sur {customer.name} : <strong>{formatMoney(remaining, currency)}</strong>
                </>
              ) : (
                <>
                  Reste non couvert : <strong>{formatMoney(remaining, currency)}</strong> — choisissez un
                  client pour le mettre à crédit.
                </>
              )}
            </p>
          )}
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          size="lg"
          loading={pending}
          disabled={!canCheckout || readOnly}
          onClick={checkout}
        >
          {readOnly ? 'Encaissement désactivé (démo)' : `Encaisser ${formatMoney(total, currency)}`}
        </Button>
      </Card>

      {/* --- Barre fixe, téléphone uniquement -----------------------------
          Le total et l'accès au panier restent visibles pendant qu'on
          parcourt le catalogue. C'était le vrai défaut de cet écran : sur
          téléphone le panier passait sous une liste de cent produits, et le
          vendeur ajoutait des articles sans jamais voir ce qu'il devait
          encaisser.

          Masquée quand la feuille est ouverte : elle ferait doublon avec le
          bouton d'encaissement qui s'y trouve déjà. */}
      {!cartOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-raised shadow-elev2 lg:hidden">
          <div className="flex items-center gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">
                {itemCount === 0
                  ? 'Panier vide'
                  : `${itemCount} article${itemCount > 1 ? 's' : ''}`}
              </p>
              <p className="truncate text-lg font-semibold tabular-nums text-ink">
                {formatMoney(total, currency)}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              variant={cart.length === 0 ? 'secondary' : 'primary'}
              disabled={cart.length === 0}
              onClick={() => setCartOpen(true)}
              // `touch-action: manipulation` supprime le délai de 300 ms que
              // le navigateur mobile réserve au double-tap : sans lui, chaque
              // appui semble mou.
              style={{ touchAction: 'manipulation' }}
              className="shrink-0"
            >
              Voir le panier
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
