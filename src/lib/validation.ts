import { z } from 'zod';

import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { PERMISSIONS } from '@/lib/rbac';
import { STORE_PERMISSIONS } from '@/lib/boutique/rbac';

/**
 * Schémas de validation partagés.
 *
 * Ils sont la frontière entre « données reçues » et « données de confiance ».
 * Toute entrée réseau les traverse avant d'atteindre la logique métier — y
 * compris les entrées d'apparence anodine, car c'est justement celles-là qu'on
 * oublie de contrôler.
 */

/** Nettoie les chaînes : espaces superflus, caractères de contrôle. */
const cleanString = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, '').trim())
    .pipe(z.string().max(max));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse email invalide.")
  .max(254);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères.`)
  .max(200);

/**
 * Numéro de téléphone : format international souple. La validation stricte
 * par pays serait fragile pour une plateforme multi-pays ; on vérifie la
 * forme générale et on laisse le restaurateur juge du reste.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Numéro de téléphone trop court.')
  .max(24)
  .regex(/^[+()\d\s.-]+$/, 'Numéro de téléphone invalide.');

export const nameSchema = cleanString(120).pipe(
  z.string().min(2, 'Au moins 2 caractères.'),
);

/** Couleur hexadécimale — validée pour éviter l'injection dans le CSS inline. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (format attendu : #RRGGBB).');

/** Montant en unité mineure : entier positif, borné pour éviter les débordements. */
export const amountSchema = z
  .number()
  .int('Le montant doit être un nombre entier.')
  .min(0, 'Le montant ne peut pas être négatif.')
  .max(1_000_000_000, 'Montant trop élevé.');

export const urlSchema = z
  .string()
  .trim()
  .url('URL invalide.')
  .max(500)
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    { message: 'L\'URL doit commencer par http:// ou https://.' },
  );

export const optionalText = (max: number) =>
  cleanString(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

// --- Authentification -------------------------------------------------------

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  restaurantName: nameSchema,
  /// Plan présélectionné depuis la page tarifs — optionnel, retombe sur le
  /// plan d'essai par défaut si absent ou invalide.
  planKey: z.string().max(40).optional(),
  /// Jeton Cloudflare Turnstile — absent si la fonctionnalité n'est pas
  /// configurée (voir `verifyTurnstile`).
  turnstileToken: z.string().max(4000).optional(),
});

/// Inscription MagyaPro Boutique — mêmes règles de validation que
/// `registerSchema`, seul le nom du tenant change de champ.
export const registerStoreSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  storeName: nameSchema,
  planKey: z.string().max(40).optional(),
  turnstileToken: z.string().max(4000).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.').max(200),
  turnstileToken: z.string().max(4000).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

// --- Restaurant -------------------------------------------------------------

export const restaurantProfileSchema = z.object({
  name: nameSchema,
  description: optionalText(2000),
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  addressLine: optionalText(240),
  city: optionalText(120),
  country: optionalText(120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  facebookUrl: urlSchema.optional().or(z.literal('').transform(() => undefined)),
  instagramUrl: urlSchema.optional().or(z.literal('').transform(() => undefined)),
  tiktokUrl: urlSchema.optional().or(z.literal('').transform(() => undefined)),
  whatsappNumber: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
});

export const restaurantAppearanceSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  fontFamily: z.enum(['Inter', 'Poppins', 'Playfair Display', 'DM Sans', 'Space Grotesk']),
  templateKey: z.string().trim().min(1).max(50),
  logoUrl: urlSchema.nullable().optional(),
  coverUrl: urlSchema.nullable().optional(),
  faviconUrl: urlSchema.nullable().optional(),
  /// Mise en avant du chef — utilisée par le template « elegant ».
  chefName: optionalText(120),
  chefBio: optionalText(600),
  chefPhoto: urlSchema.nullable().optional(),
});

export const restaurantSeoSchema = z.object({
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
  seoImageUrl: urlSchema.nullable().optional(),
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (format attendu : HH:MM).');

export const openingHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isClosed: z.boolean(),
        opensAt: timeSchema,
        closesAt: timeSchema,
      }),
    )
    .length(7, 'Les sept jours de la semaine doivent être fournis.'),
});

export const restaurantSettingsSchema = z.object({
  orderingEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  tableOrderingEnabled: z.boolean(),
  minOrderAmount: amountSchema,
  prepTimeMinutes: z.number().int().min(0).max(600),
  paymentProviders: z.array(z.string().max(50)).max(10),
  orangeMoneyNumber: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  waveNumber: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  notificationEmail: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  reservationGraceMinutes: z.number().int().min(0).max(600),
});

export const restaurantAdvancedSchema = z.object({
  taxEnabled: z.boolean(),
  /// Pourcentage. `null` tant que la TVA n'est pas activée.
  taxRate: z.number().min(0).max(100).nullable(),
  taxLabel: cleanString(20).default('TVA'),
  googleAnalyticsId: optionalText(30),
  metaPixelId: optionalText(30),
});

// --- Menu -------------------------------------------------------------------

export const categorySchema = z.object({
  name: nameSchema,
  description: optionalText(500),
  imageUrl: urlSchema.nullable().optional(),
  isActive: z.boolean().default(true),
  nameEn: optionalText(120),
  nameAr: optionalText(120),
  descriptionEn: optionalText(500),
  descriptionAr: optionalText(500),
});

export const productOptionGroupSchema = z.object({
  name: cleanString(80).pipe(z.string().min(1, 'Nom requis.')),
  minSelect: z.number().int().min(0).max(20),
  maxSelect: z.number().int().min(1).max(20),
  options: z
    .array(
      z.object({
        name: cleanString(80).pipe(z.string().min(1, 'Nom requis.')),
        priceDelta: z.number().int().min(-1_000_000).max(1_000_000),
        isAvailable: z.boolean().default(true),
      }),
    )
    .min(1, 'Ajoutez au moins une option.')
    .max(30),
}).refine((group) => group.maxSelect >= group.minSelect, {
  message: 'Le maximum doit être supérieur ou égal au minimum.',
  path: ['maxSelect'],
});

export const productSchema = z.object({
  categoryId: z.string().min(1, 'Choisissez une catégorie.'),
  name: nameSchema,
  description: optionalText(2000),
  imageUrl: urlSchema.nullable().optional(),
  price: amountSchema,
  compareAtPrice: amountSchema.nullable().optional(),
  costPrice: amountSchema.nullable().optional(),
  isAvailable: z.boolean().default(true),
  badge: z.enum(['NONE', 'POPULAR', 'NEW', 'PROMOTION', 'SOLD_OUT']).default('NONE'),
  nameEn: optionalText(120),
  nameAr: optionalText(120),
  descriptionEn: optionalText(2000),
  descriptionAr: optionalText(2000),
  variants: z
    .array(
      z.object({
        name: cleanString(80).pipe(z.string().min(1, 'Nom requis.')),
        price: amountSchema,
        isAvailable: z.boolean().default(true),
      }),
    )
    .max(20)
    .default([]),
  optionGroups: z.array(productOptionGroupSchema).max(10).default([]),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

/** Attribution rapide d'une photo, sans repasser tout le produit. */
export const productPhotoSchema = z.object({
  imageUrl: urlSchema,
});

// --- Livraison & promotions -------------------------------------------------

export const deliveryZoneSchema = z.object({
  name: nameSchema,
  fee: amountSchema,
  minOrder: amountSchema,
  freeAbove: amountSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

export const promotionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Au moins 3 caractères.')
      .max(24)
      .regex(/^[A-Z0-9_-]+$/, 'Lettres majuscules, chiffres, tiret et souligné uniquement.'),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int().min(1, 'La valeur doit être supérieure à zéro.'),
    minOrder: amountSchema.default(0),
    maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((promo) => promo.type !== 'PERCENT' || promo.value <= 100, {
    message: 'Une remise en pourcentage ne peut pas dépasser 100 %.',
    path: ['value'],
  })
  .refine((promo) => !promo.startsAt || !promo.endsAt || promo.endsAt > promo.startsAt, {
    message: 'La date de fin doit être postérieure à la date de début.',
    path: ['endsAt'],
  });

export const loyaltyTierSchema = z
  .object({
    name: cleanString(60).pipe(z.string().min(1, 'Nom requis.')),
    thresholdSpent: amountSchema.refine((value) => value > 0, {
      message: 'Le seuil doit être supérieur à zéro.',
    }),
    rewardType: z.enum(['PERCENT', 'FIXED']),
    rewardValue: z.number().int().min(1, 'La valeur doit être supérieure à zéro.'),
    isActive: z.boolean().default(true),
  })
  .refine((tier) => tier.rewardType !== 'PERCENT' || tier.rewardValue <= 100, {
    message: 'Une remise en pourcentage ne peut pas dépasser 100 %.',
    path: ['rewardValue'],
  });

// --- Commande publique ------------------------------------------------------

/**
 * Panier envoyé par le site public.
 *
 * Remarque capitale : aucun **prix** n'est accepté ici. Le client transmet
 * seulement *ce qu'il veut* (identifiants et quantités) ; les montants sont
 * relus en base par le moteur de tarification.
 */
export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  optionIds: z.array(z.string().min(1)).max(30).default([]),
  quantity: z.number().int().min(1, 'Quantité minimale : 1.').max(99),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Votre panier est vide.').max(50),
  fulfillmentType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']),
  deliveryZoneId: z.string().min(1).nullable().optional(),
  /// Présent uniquement pour une commande passée depuis une table.
  tableToken: z.string().min(1).max(60).optional(),
  customerName: nameSchema,
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  deliveryAddress: optionalText(300),
  /// Position GPS, partagée volontairement par le client pour aider le
  /// livreur — jamais requise.
  deliveryLat: z.number().min(-90).max(90).nullable().optional(),
  deliveryLng: z.number().min(-180).max(180).nullable().optional(),
  instructions: optionalText(500),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(24)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  paymentProvider: z.string().trim().min(1).max(50),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    'NEW', 'CONFIRMED', 'PREPARING', 'READY',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
  ]),
  note: optionalText(500),
});

// --- Avis & réservations -----------------------------------------------------

export const reviewSchema = z.object({
  orderId: z.string().min(1).nullable().optional(),
  customerName: nameSchema,
  rating: z.number().int().min(1, 'Note minimale : 1.').max(5, 'Note maximale : 5.'),
  comment: optionalText(1000),
});

export const reviewModerationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const reservationSchema = z.object({
  customerName: nameSchema,
  customerPhone: phoneSchema,
  partySize: z.number().int().min(1, 'Au moins une personne.').max(50),
  // Coercition depuis une chaîne ISO envoyée par le formulaire public.
  reservedFor: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    message: 'Choisissez une date et une heure à venir.',
  }),
  notes: optionalText(500),
});

export const reservationStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
});

// --- Galerie -------------------------------------------------------------------

export const galleryImageSchema = z.object({
  imageUrl: urlSchema,
  caption: optionalText(200),
});

export const galleryCaptionSchema = z.object({
  caption: optionalText(200),
});

// --- Service à table ---------------------------------------------------------

export const tableSchema = z.object({
  label: cleanString(60).pipe(z.string().min(1, 'Nom requis.')),
});

export const tableStatusSchema = z.object({
  status: z.enum(['FREE', 'OCCUPIED', 'NEEDS_CLEANING']),
});

export const tableRequestSchema = z.object({
  type: z.enum(['CALL', 'BILL']),
});

export const paymentVerificationSchema = z.object({
  status: z.enum(['PAID', 'FAILED']),
  failureReason: optionalText(300),
});

// --- Finances ------------------------------------------------------------------

export const expenseSchema = z.object({
  label: cleanString(120).pipe(z.string().min(1, 'Nom requis.')),
  amount: amountSchema.refine((value) => value > 0, {
    message: 'Le montant doit être supérieur à zéro.',
  }),
  category: z.enum(['INGREDIENTS', 'STAFF', 'RENT', 'UTILITIES', 'OTHER']),
  incurredAt: z.coerce.date(),
  notes: optionalText(500),
});

// --- Livraison ---------------------------------------------------------------

export const deliveryConfirmationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code à six chiffres.'),
});

// --- Équipe -----------------------------------------------------------------

export const teamMemberSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(['ADMIN', 'EMPLOYEE', 'COURIER']),
  extraPermissions: z
    .array(z.enum(PERMISSIONS as unknown as [string, ...string[]]))
    .max(PERMISSIONS.length)
    .default([]),
});

// --- Super Admin ------------------------------------------------------------

export const planSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'Lettres minuscules, chiffres, tiret et souligné uniquement.'),
  product: z.enum(['RESTAURANT', 'STORE']).default('RESTAURANT'),
  name: nameSchema,
  description: optionalText(500),
  price: amountSchema,
  currency: z.string().trim().toUpperCase().length(3),
  interval: z.enum(['MONTH', 'YEAR']),
  trialDays: z.number().int().min(0).max(365),
  features: z.array(z.string().max(50)).max(30).default([]),
  limits: z
    .object({
      maxProducts: z.number().int().min(-1).max(100_000).optional(),
      maxCategories: z.number().int().min(-1).max(10_000).optional(),
      maxUsers: z.number().int().min(-1).max(1_000).optional(),
      maxOrdersPerMonth: z.number().int().min(-1).max(1_000_000).optional(),
    })
    .default({}),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0).max(100).default(0),
});

export const supportAccessSchema = z.object({
  restaurantId: z.string().min(1),
  reason: cleanString(300).pipe(
    z.string().min(10, 'Précisez le motif (au moins 10 caractères).'),
  ),
});

export const storeSupportAccessSchema = z.object({
  storeId: z.string().min(1),
  reason: cleanString(300).pipe(
    z.string().min(10, 'Précisez le motif (au moins 10 caractères).'),
  ),
});

export const domainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .regex(
      /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/,
      'Nom de domaine invalide (exemple : www.mon-restaurant.com).',
    ),
});

// --- Onboarding -------------------------------------------------------------

export const onboardingStepSchema = z.object({
  step: z.number().int().min(0).max(10),
});

// --- MagyaPro Boutique --------------------------------------------------

export const storeCategorySchema = z.object({
  name: nameSchema,
  parentId: z.string().min(1).nullable().optional(),
});

export const storeBrandSchema = z.object({
  name: nameSchema,
  logoUrl: urlSchema.nullable().optional(),
});

/**
 * Création d'un produit — combine la fiche produit et sa première variante
 * (voir `StoreProductVariant` dans le schéma : un produit sans variante
 * déclarée reçoit une variante par défaut, gérée ici plutôt qu'en base).
 */
/** Attributs de variante libres (ex. { "taille": "M", "couleur": "Rouge" }) —
 *  clés et valeurs bornées en longueur, nombre de paires limité, pour éviter
 *  qu'un champ pensé pour quelques attributs de présentation ne serve à
 *  stocker un objet arbitraire. */
export const variantAttributesSchema = z
  .record(z.string().max(60), z.string().max(200))
  .refine((obj) => Object.keys(obj).length <= 10, 'Trop d’attributs (10 maximum).')
  .default({});

/**
 * Quantité Boutique — décimale à 3 décimales (vente au poids/volume : kg, g,
 * L, mL). Arrondie plutôt que rejetée par une précision excessive : le
 * client ne doit pas voir une erreur pour un troisième chiffre après la
 * virgule saisi par accident, la colonne en base est de toute façon limitée
 * à cette précision.
 */
export const quantitySchema = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .transform((value) => Math.round(value * 1000) / 1000);

export const storeProductSchema = z.object({
  name: nameSchema,
  description: optionalText(1000),
  categoryId: z.string().min(1).nullable().optional(),
  brandId: z.string().min(1).nullable().optional(),
  supplierId: z.string().min(1).nullable().optional(),
  imageUrl: urlSchema.nullable().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('DRAFT'),
  minStockAlert: quantitySchema(1_000_000).default(0),
  unit: z.enum(['UNIT', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'PACK']).default('UNIT'),
  sku: optionalText(60),
  barcode: optionalText(60),
  cost: amountSchema,
  price: amountSchema,
  attributes: variantAttributesSchema,
  /** Quantité en stock à la création — mouvement `INITIAL`, jamais silencieux. */
  initialStock: quantitySchema(1_000_000).default(0),
  /** Date de péremption du stock initial, facultative — crée un lot suivi séparément. */
  initialStockExpiryDate: z.coerce.date().optional(),
});

export const storeSupplierSchema = z.object({
  name: nameSchema,
  contactName: optionalText(120),
  phone: optionalText(30),
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  address: optionalText(200),
  paymentTerms: optionalText(200),
});

/**
 * Commande d'achat — première version : réception complète uniquement (pas
 * de réception partielle), un seul entrepôt (celui par défaut). Les coûts
 * saisis ici deviennent le nouveau coût d'achat des variantes concernées à
 * la réception, pour que la marge affichée reste à jour.
 */
export const storePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: quantitySchema(100_000).refine((v) => v > 0, 'La quantité doit être supérieure à zéro.'),
        unitCost: amountSchema,
      }),
    )
    .min(1, 'Ajoutez au moins un produit.')
    .max(200),
  note: optionalText(500),
});

export const openCashSessionSchema = z.object({
  openingBalance: amountSchema,
});

export const closeCashSessionSchema = z.object({
  countedBalance: amountSchema,
});

export const cashMovementSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: amountSchema.refine((v) => v > 0, 'Le montant doit être supérieur à zéro.'),
  reason: optionalText(200),
});

export const storePromotionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Au moins 2 caractères.')
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, 'Lettres, chiffres, tirets et underscores uniquement.'),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int().min(1),
    minCartAmount: amountSchema.default(0),
    maxRedemptions: z.number().int().min(1).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.type !== 'PERCENT' || data.value <= 100, {
    message: 'Un pourcentage ne peut pas dépasser 100.',
    path: ['value'],
  })
  .refine((data) => !data.startsAt || !data.endsAt || data.startsAt <= data.endsAt, {
    message: 'La date de fin doit être après la date de début.',
    path: ['endsAt'],
  });

export const storeCustomerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  address: optionalText(200),
  notes: optionalText(500),
  creditLimit: amountSchema.default(0),
});

export const storeCreditPaymentSchema = z.object({
  amount: amountSchema.refine((v) => v > 0, 'Le montant doit être supérieur à zéro.'),
  note: optionalText(200),
});

/**
 * Commande passée depuis le site public d'une boutique — retrait en
 * boutique uniquement, aucun paiement en ligne dans cette première
 * version : le client règle sur place. Comme pour la vente en caisse, les
 * prix ne sont jamais pris depuis la requête, seuls `productId` et
 * `quantity` sont lus ici.
 */
export const publicStoreOrderSchema = z.object({
  storeId: z.string().min(1),
  customerName: nameSchema,
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  notes: optionalText(300),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: quantitySchema(10_000).refine((v) => v > 0, 'La quantité doit être supérieure à zéro.'),
      }),
    )
    .min(1, 'Le panier est vide.')
    .max(50),
});

export const storeOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED']),
});

export const storeReturnSchema = z.object({
  saleId: z.string().min(1),
  resolution: z.enum(['REFUND', 'EXCHANGE']),
  reason: optionalText(300),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: quantitySchema(10_000).refine((v) => v > 0, 'La quantité doit être supérieure à zéro.'),
      }),
    )
    .min(1, 'Sélectionnez au moins un article à retourner.')
    .max(200),
});

export const storeExpenseSchema = z.object({
  label: z.string().trim().min(1, 'Indiquez un libellé.').max(200),
  amount: amountSchema.refine((v) => v > 0, 'Le montant doit être supérieur à zéro.'),
  category: z.enum([
    'RENT',
    'UTILITIES',
    'STAFF',
    'TRANSPORT',
    'MARKETING',
    'MAINTENANCE',
    'SUPPLIES',
    'OTHER',
  ]),
  incurredAt: z.coerce.date(),
  notes: optionalText(500),
});

export const storeTeamMemberSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'SALESPERSON', 'STOCK_MANAGER', 'ACCOUNTANT']),
  extraPermissions: z
    .array(z.enum(STORE_PERMISSIONS as unknown as [string, ...string[]]))
    .max(STORE_PERMISSIONS.length)
    .default([]),
});

export const storeTeamMemberUpdateSchema = storeTeamMemberSchema.omit({ email: true, name: true });

/**
 * Vente (caisse/POS). Les prix ne sont **jamais** pris depuis la requête —
 * seuls `productVariantId` et `quantity` sont lus ici ; le serveur
 * recalcule chaque montant depuis la base (voir la route associée).
 *
 * Deux modes, exclusifs : paiement immédiat (`paymentMethod` requis) ou
 * vente à crédit (`isCredit: true`, `customerId` requis) — pas encore de
 * paiement scindé entre les deux dans cette première version.
 */
export const storeSaleSchema = z
  .object({
    items: z
      .array(
        z.object({
          productVariantId: z.string().min(1),
          quantity: quantitySchema(10_000).refine((v) => v > 0, 'La quantité doit être supérieure à zéro.'),
        }),
      )
      .min(1, 'Le panier est vide.')
      .max(200),
    /** Identifiant libre du moyen de paiement — voir `StorePayment.method`. */
    paymentMethod: z.string().min(1).max(40).optional(),
    customerId: z.string().min(1).optional(),
    isCredit: z.boolean().default(false),
    discount: amountSchema.default(0),
    /** Code promo saisi par le caissier — jamais son montant : le rabais est
     *  toujours recalculé côté serveur depuis la promotion elle-même. */
    promoCode: z.string().trim().max(30).optional(),
  })
  .refine((data) => data.isCredit || Boolean(data.paymentMethod), {
    message: 'Choisissez un moyen de paiement.',
    path: ['paymentMethod'],
  })
  .refine((data) => !data.isCredit || Boolean(data.customerId), {
    message: 'Une vente à crédit doit être associée à un client.',
    path: ['customerId'],
  });
