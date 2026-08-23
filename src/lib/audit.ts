import { prisma } from '@/lib/db';

/**
 * Journal d'audit.
 *
 * Il enregistre le *qui, quoi, sur quoi, quand* des actions sensibles. Deux
 * usages : reconstituer un incident, et rendre visible l'activité de
 * l'assistance sur l'espace d'un client.
 *
 * Ce qui n'entre jamais dans un log : mot de passe, jeton, empreinte de jeton,
 * numéro de carte. Les métadonnées passent par `sanitize()`.
 */

export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_SUSPENDED: 'user.suspended',
  USER_REACTIVATED: 'user.reactivated',

  RESTAURANT_CREATED: 'restaurant.created',
  RESTAURANT_UPDATED: 'restaurant.updated',
  RESTAURANT_PUBLISHED: 'restaurant.published',
  RESTAURANT_SUSPENDED: 'restaurant.suspended',
  RESTAURANT_REACTIVATED: 'restaurant.reactivated',
  RESTAURANT_DELETED: 'restaurant.deleted',

  MENU_CATEGORY_CREATED: 'menu.category_created',
  MENU_CATEGORY_UPDATED: 'menu.category_updated',
  MENU_CATEGORY_DELETED: 'menu.category_deleted',
  MENU_PRODUCT_CREATED: 'menu.product_created',
  MENU_PRODUCT_UPDATED: 'menu.product_updated',
  MENU_PRODUCT_DELETED: 'menu.product_deleted',

  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',

  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_STATUS_CHANGED: 'payment.status_changed',

  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',
  PLAN_DELETED: 'plan.deleted',
  SUBSCRIPTION_CHANGED: 'subscription.changed',
  SUBSCRIPTION_PAYMENT_REQUESTED: 'subscription_payment.requested',
  SUBSCRIPTION_PAYMENT_APPROVED: 'subscription_payment.approved',
  SUBSCRIPTION_PAYMENT_REJECTED: 'subscription_payment.rejected',

  TEAM_MEMBER_ADDED: 'team.member_added',
  TEAM_MEMBER_UPDATED: 'team.member_updated',
  TEAM_MEMBER_REMOVED: 'team.member_removed',

  SUPPORT_ACCESS_STARTED: 'support.access_started',
  SUPPORT_ACCESS_ENDED: 'support.access_ended',

  DOMAIN_ADDED: 'domain.added',
  DOMAIN_VERIFIED: 'domain.verified',
  DOMAIN_REMOVED: 'domain.removed',

  ANNOUNCEMENT_CREATED: 'announcement.created',
  ANNOUNCEMENT_UPDATED: 'announcement.updated',
  ANNOUNCEMENT_DELETED: 'announcement.deleted',

  // MagyaPro Boutique — préfixe `store.` distinct de `restaurant.` : jamais
  // les mêmes actions, jamais la même table de conversion en clair.
  STORE_CREATED: 'store.created',
  STORE_UPDATED: 'store.updated',
  STORE_PUBLISHED: 'store.published',
  STORE_SUSPENDED: 'store.suspended',
  STORE_REACTIVATED: 'store.reactivated',
  STORE_DELETED: 'store.deleted',

  STORE_CATEGORY_CREATED: 'store_category.created',
  STORE_CATEGORY_UPDATED: 'store_category.updated',
  STORE_CATEGORY_DELETED: 'store_category.deleted',
  STORE_BRAND_CREATED: 'store_brand.created',
  STORE_BRAND_UPDATED: 'store_brand.updated',
  STORE_BRAND_DELETED: 'store_brand.deleted',
  STORE_PRODUCT_CREATED: 'store_product.created',
  STORE_PRODUCT_UPDATED: 'store_product.updated',
  STORE_PRODUCT_DELETED: 'store_product.deleted',
  SALE_CREATED: 'sale.created',
  SALE_REFUNDED: 'sale.refunded',
  STORE_SUPPLIER_CREATED: 'store_supplier.created',
  STORE_SUPPLIER_UPDATED: 'store_supplier.updated',
  STORE_SUPPLIER_DELETED: 'store_supplier.deleted',
  PURCHASE_ORDER_CREATED: 'purchase_order.created',
  PURCHASE_ORDER_RECEIVED: 'purchase_order.received',
  STORE_CUSTOMER_CREATED: 'store_customer.created',
  STORE_CUSTOMER_UPDATED: 'store_customer.updated',
  STORE_CREDIT_PAYMENT_RECORDED: 'store_credit_payment.recorded',
  CASH_SESSION_OPENED: 'cash_session.opened',
  CASH_SESSION_CLOSED: 'cash_session.closed',
  CASH_MOVEMENT_RECORDED: 'cash_movement.recorded',
  STORE_TEAM_MEMBER_ADDED: 'store_team_member.added',
  STORE_TEAM_MEMBER_UPDATED: 'store_team_member.updated',
  STORE_TEAM_MEMBER_REMOVED: 'store_team_member.removed',
  STORE_RETURN_CREATED: 'store_return.created',
  STORE_EXPENSE_CREATED: 'store_expense.created',
  STORE_EXPENSE_UPDATED: 'store_expense.updated',
  STORE_EXPENSE_DELETED: 'store_expense.deleted',
  STORE_INVOICE_CREATED: 'store_invoice.created',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const REDACTED_KEYS = [
  'password', 'passwordhash', 'token', 'tokenhash', 'secret', 'apikey',
  'api_key', 'authorization', 'cookie', 'card', 'cvv', 'pin',
];

/** Retire les valeurs sensibles avant persistance. */
function sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle))) {
      clean[key] = '[masqué]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitize(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export type AuditInput = {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmail?: string | null;
  restaurantId?: string | null;
  storeId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Écrit une entrée d'audit.
 *
 * L'échec d'écriture ne fait jamais échouer l'action métier : perdre une ligne
 * de journal est regrettable, refuser une commande à cause d'elle serait pire.
 * L'échec est en revanche remonté dans les logs serveur.
 */
/**
 * Compare deux instantanés d'une même ressource et ne garde que les champs
 * qui ont réellement changé — c'est cette liste réduite qui alimente la
 * comparaison avant/après du journal, plutôt que deux objets complets peu
 * lisibles.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from: from ?? null, to: to ?? null };
    }
  }
  return diff;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        restaurantId: input.restaurantId ?? null,
        storeId: input.storeId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ip: input.ip ?? null,
        metadata: sanitize(input.metadata ?? {}) as never,
      },
    });
  } catch (error) {
    console.error("[audit] Échec d'écriture du journal :", error);
  }
}
