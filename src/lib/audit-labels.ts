/**
 * Libellés lisibles des actions du journal d'audit — « Boutique · connexion »
 * plutôt que `user.login`. Le code brut reste affiché à côté, en petit :
 * c'est lui qu'on recherche et qu'on cite à l'équipe technique.
 */

const SUBJECTS: Record<string, string> = {
  user: 'Compte',
  restaurant: 'Restaurant',
  menu: 'Menu',
  order: 'Commande',
  payment: 'Paiement',
  plan: 'Plan',
  subscription: 'Abonnement',
  subscription_payment: "Paiement d'abonnement",
  team: 'Équipe',
  support: 'Accès support',
  domain: 'Domaine',
  announcement: 'Annonce',
  store: 'Boutique',
  store_demo: 'Démo boutique',
  store_category: 'Catégorie',
  store_brand: 'Marque',
  store_product: 'Produit',
  store_products: 'Produits',
  store_stock: 'Stock',
  sale: 'Vente',
  store_supplier: 'Fournisseur',
  purchase_order: 'Commande fournisseur',
  supplier_payment: 'Paiement fournisseur',
  store_customer: 'Client',
  store_credit_payment: 'Règlement de crédit',
  cash_session: 'Caisse',
  cash_movement: 'Mouvement de caisse',
  store_team_member: 'Équipe boutique',
  store_return: 'Retour',
  store_expense: 'Dépense',
  store_invoice: 'Facture',
  store_promotion: 'Promotion',
};

const VERBS: Record<string, string> = {
  registered: 'inscription',
  login: 'connexion',
  login_failed: 'connexion refusée',
  logout: 'déconnexion',
  password_reset: 'mot de passe réinitialisé',
  email_verified: 'email vérifié',
  two_factor_enabled: 'double authentification activée',
  two_factor_disabled: 'double authentification désactivée',
  suspended: 'suspension',
  reactivated: 'réactivation',
  created: 'création',
  updated: 'modification',
  published: 'publication',
  deleted: 'suppression',
  category_created: 'catégorie créée',
  category_updated: 'catégorie modifiée',
  category_deleted: 'catégorie supprimée',
  product_created: 'plat créé',
  product_updated: 'plat modifié',
  product_deleted: 'plat supprimé',
  status_changed: 'changement de statut',
  cancelled: 'annulation',
  initiated: 'lancement',
  changed: 'changement',
  requested: 'demande',
  approved: 'validation',
  rejected: 'refus',
  member_added: 'membre ajouté',
  member_updated: 'membre modifié',
  member_removed: 'membre retiré',
  access_started: 'début',
  access_ended: 'fin',
  added: 'ajout',
  verified: 'vérification',
  removed: 'retrait',
  seeded: 'création',
  cleaned: 'nettoyage',
  reset: 'réinitialisation',
  imported: 'import',
  counted: 'inventaire',
  transferred: 'transfert envoyé',
  transfer_received: 'transfert reçu',
  transfer_cancelled: 'transfert annulé',
  refunded: 'remboursement',
  confirmed: 'confirmation',
  received: 'réception',
  recorded: 'enregistrement',
  opened: 'ouverture',
  closed: 'fermeture',
};

export function auditActionLabel(action: string): string {
  const dot = action.indexOf('.');
  if (dot < 0) return action;
  const subject = SUBJECTS[action.slice(0, dot)];
  const verb = VERBS[action.slice(dot + 1)];
  if (!subject || !verb) return action;
  return `${subject} · ${verb}`;
}
