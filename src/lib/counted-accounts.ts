import type { Prisma } from '@prisma/client';

/**
 * Comptes qui entrent dans les chiffres de la plateforme.
 *
 * Deux sortes de comptes faussaient la recette et les statistiques du Super
 * Admin :
 * - les comptes de démonstration (`isDemo`), avec leurs ventes et leurs
 *   abonnements fictifs, générés pour la vitrine et la visite libre ;
 * - les comptes de test (`isTest`), ouverts pour essayer le produit, marqués
 *   comme tels depuis le Super Admin.
 *
 * Toute requête qui calcule un chiffre de la plateforme passe par ces filtres,
 * et par eux seulement : un nouveau critère d'exclusion n'aura qu'un endroit
 * où s'ajouter. Les listes de comptes, elles, les montrent tous — avec un
 * badge — pour qu'on puisse les retrouver et les gérer.
 */
export const COUNTED_RESTAURANT = { isDemo: false, isTest: false } satisfies Prisma.RestaurantWhereInput;

export const COUNTED_STORE = { isDemo: false, isTest: false } satisfies Prisma.StoreWhereInput;

/**
 * Utilisateurs comptés : ni compte de démonstration, ni membre de l'équipe
 * MagyaPro, ni rattaché seulement à des commerces exclus. Un inscrit qui n'a
 * encore créé aucun commerce compte : c'est un vrai visiteur.
 */
export const COUNTED_USER = {
  isDemo: false,
  platformRole: 'USER',
  NOT: {
    AND: [
      { OR: [{ memberships: { some: {} } }, { storeMemberships: { some: {} } }] },
      { memberships: { none: { restaurant: COUNTED_RESTAURANT } } },
      { storeMemberships: { none: { store: COUNTED_STORE } } },
    ],
  },
} satisfies Prisma.UserWhereInput;
