import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';

/**
 * Traductions du site public d'une boutique (`/s/[host]`) — langue fixée
 * par le commerçant (`Store.language`, configurée dans Réglages), pas
 * choisie par le visiteur : à la différence du switcher de Restaurant
 * (cookie par visiteur), toute une boutique s'affiche dans une seule
 * langue à la fois. Fichier séparé du dictionnaire Restaurant
 * (`dictionary.ts`) — vocabulaire et pages différents, jamais partagé.
 */
export type BoutiqueSiteDictionary = {
  catalog: string;
  cart: string;
  poweredBy: string;
  businessTypes: Record<string, string>;
  viewCatalog: string;
  noProductsYet: string;
  products: string;
  viewFullCatalog: string;
  all: string;
  searchPlaceholder: string;
  noSearchResults: string;
  backToCatalog: string;
  inStock: string;
  outOfStock: string;
  callStore: string;
  whatsapp: string;
  interestedIn: (productName: string) => string;
  addToCart: string;
  viewCartArrow: string;
  cartEmpty: string;
  total: string;
  yourDetails: string;
  pickupPayOnSite: string;
  name: string;
  phone: string;
  emailOptional: string;
  messageOptional: string;
  sending: string;
  orderButton: (total: string) => string;
  orderNumber: (number: number) => string;
  pickupAt: (storeName: string, addressLine?: string | null) => string;
  continueShopping: string;
  orderStatus: Record<string, string>;
};

const fr: BoutiqueSiteDictionary = {
  catalog: 'Catalogue',
  cart: 'Panier',
  poweredBy: 'Propulsé par',
  businessTypes: {
    CLOTHING: 'Habillement',
    SHOES: 'Chaussures',
    ELECTRONICS: 'Électronique',
    COSMETICS: 'Cosmétique',
    GROCERY: 'Alimentation',
    MERCERIE: 'Mercerie',
    HARDWARE: 'Quincaillerie',
    CONSTRUCTION: 'Matériaux',
    HOUSEHOLD: 'Produits ménagers',
    PHARMACY: 'Parapharmacie',
    GENERAL: 'Commerce général',
    OTHER: 'Commerce',
  },
  viewCatalog: 'Voir le catalogue',
  noProductsYet: 'Aucun produit disponible pour le moment.',
  products: 'Produits',
  viewFullCatalog: 'Voir tout le catalogue',
  all: 'Tout',
  searchPlaceholder: 'Rechercher un produit…',
  noSearchResults: 'Aucun produit ne correspond à cette recherche.',
  backToCatalog: '← Catalogue',
  inStock: 'En stock',
  outOfStock: 'Rupture de stock',
  callStore: 'Appeler la boutique',
  whatsapp: 'WhatsApp',
  interestedIn: (name) => `Bonjour, je suis intéressé(e) par « ${name} ».`,
  addToCart: 'Ajouter au panier',
  viewCartArrow: 'Voir le panier →',
  cartEmpty: 'Votre panier est vide.',
  total: 'Total',
  yourDetails: 'Vos coordonnées',
  pickupPayOnSite: 'À retirer en boutique — vous réglerez sur place.',
  name: 'Nom',
  phone: 'Téléphone',
  emailOptional: 'Email (facultatif)',
  messageOptional: 'Message (facultatif)',
  sending: 'Envoi…',
  orderButton: (total) => `Commander — ${total}`,
  orderNumber: (number) => `Commande n°${number}`,
  pickupAt: (storeName, addressLine) =>
    `À retirer en boutique — ${storeName}${addressLine ? `, ${addressLine}` : ''}. Vous réglerez sur place.`,
  continueShopping: 'Continuer mes achats',
  orderStatus: {
    PENDING: 'En attente de confirmation',
    CONFIRMED: 'Confirmée',
    READY: 'Prête pour retrait',
    COMPLETED: 'Terminée',
    CANCELLED: 'Annulée',
  },
};

const en: BoutiqueSiteDictionary = {
  catalog: 'Catalog',
  cart: 'Cart',
  poweredBy: 'Powered by',
  businessTypes: {
    CLOTHING: 'Clothing',
    SHOES: 'Shoes',
    ELECTRONICS: 'Electronics',
    COSMETICS: 'Cosmetics',
    GROCERY: 'Grocery',
    MERCERIE: 'Haberdashery',
    HARDWARE: 'Hardware',
    CONSTRUCTION: 'Building materials',
    HOUSEHOLD: 'Household goods',
    PHARMACY: 'Parapharmacy',
    GENERAL: 'General store',
    OTHER: 'Shop',
  },
  viewCatalog: 'View catalog',
  noProductsYet: 'No products available yet.',
  products: 'Products',
  viewFullCatalog: 'View full catalog',
  all: 'All',
  searchPlaceholder: 'Search a product…',
  noSearchResults: 'No product matches this search.',
  backToCatalog: '← Catalog',
  inStock: 'In stock',
  outOfStock: 'Out of stock',
  callStore: 'Call the shop',
  whatsapp: 'WhatsApp',
  interestedIn: (name) => `Hello, I'm interested in "${name}".`,
  addToCart: 'Add to cart',
  viewCartArrow: 'View cart →',
  cartEmpty: 'Your cart is empty.',
  total: 'Total',
  yourDetails: 'Your details',
  pickupPayOnSite: 'Pickup in store — you will pay on site.',
  name: 'Name',
  phone: 'Phone',
  emailOptional: 'Email (optional)',
  messageOptional: 'Message (optional)',
  sending: 'Sending…',
  orderButton: (total) => `Order — ${total}`,
  orderNumber: (number) => `Order #${number}`,
  pickupAt: (storeName, addressLine) =>
    `Pickup in store — ${storeName}${addressLine ? `, ${addressLine}` : ''}. You will pay on site.`,
  continueShopping: 'Continue shopping',
  orderStatus: {
    PENDING: 'Awaiting confirmation',
    CONFIRMED: 'Confirmed',
    READY: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  },
};

const ar: BoutiqueSiteDictionary = {
  catalog: 'الكتالوج',
  cart: 'السلة',
  poweredBy: 'بدعم من',
  businessTypes: {
    CLOTHING: 'ملابس',
    SHOES: 'أحذية',
    ELECTRONICS: 'إلكترونيات',
    COSMETICS: 'مستحضرات تجميل',
    GROCERY: 'بقالة',
    MERCERIE: 'مواد الخياطة',
    HARDWARE: 'أدوات معدنية',
    CONSTRUCTION: 'مواد البناء',
    HOUSEHOLD: 'مستلزمات منزلية',
    PHARMACY: 'مستلزمات صيدلانية',
    GENERAL: 'متجر عام',
    OTHER: 'متجر',
  },
  viewCatalog: 'عرض الكتالوج',
  noProductsYet: 'لا توجد منتجات متاحة حاليًا.',
  products: 'المنتجات',
  viewFullCatalog: 'عرض الكتالوج الكامل',
  all: 'الكل',
  searchPlaceholder: 'ابحث عن منتج…',
  noSearchResults: 'لا يوجد منتج يطابق هذا البحث.',
  backToCatalog: '→ الكتالوج',
  inStock: 'متوفر',
  outOfStock: 'نفدت الكمية',
  callStore: 'اتصل بالمتجر',
  whatsapp: 'واتساب',
  interestedIn: (name) => `مرحبًا، أنا مهتم بـ « ${name} ».`,
  addToCart: 'أضف إلى السلة',
  viewCartArrow: '← عرض السلة',
  cartEmpty: 'سلتك فارغة.',
  total: 'المجموع',
  yourDetails: 'بياناتك',
  pickupPayOnSite: 'الاستلام من المتجر — الدفع عند الاستلام.',
  name: 'الاسم',
  phone: 'الهاتف',
  emailOptional: 'البريد الإلكتروني (اختياري)',
  messageOptional: 'رسالة (اختياري)',
  sending: 'جارٍ الإرسال…',
  orderButton: (total) => `اطلب — ${total}`,
  orderNumber: (number) => `الطلب رقم ${number}`,
  pickupAt: (storeName, addressLine) =>
    `الاستلام من المتجر — ${storeName}${addressLine ? `، ${addressLine}` : ''}. الدفع عند الاستلام.`,
  continueShopping: 'متابعة التسوق',
  orderStatus: {
    PENDING: 'بانتظار التأكيد',
    CONFIRMED: 'مؤكد',
    READY: 'جاهز للاستلام',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغى',
  },
};

const BOUTIQUE_SITE_DICTIONARIES: Record<Locale, BoutiqueSiteDictionary> = { fr, en, ar };

export function getBoutiqueSiteDictionary(locale: string): BoutiqueSiteDictionary {
  return BOUTIQUE_SITE_DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}
