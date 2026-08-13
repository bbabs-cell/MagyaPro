import { z } from 'zod';

import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { PERMISSIONS } from '@/lib/rbac';

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

const optionalText = (max: number) =>
  cleanString(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

// --- Authentification -------------------------------------------------------

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  restaurantName: nameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.').max(200),
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
  notificationEmail: emailSchema.optional().or(z.literal('').transform(() => undefined)),
});

// --- Menu -------------------------------------------------------------------

export const categorySchema = z.object({
  name: nameSchema,
  description: optionalText(500),
  imageUrl: urlSchema.nullable().optional(),
  isActive: z.boolean().default(true),
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
  isAvailable: z.boolean().default(true),
  badge: z.enum(['NONE', 'POPULAR', 'NEW', 'PROMOTION', 'SOLD_OUT']).default('NONE'),
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
    'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED',
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

// --- Équipe -----------------------------------------------------------------

export const teamMemberSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(['ADMIN', 'EMPLOYEE']),
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
