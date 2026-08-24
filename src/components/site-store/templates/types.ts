import type { PublicProduct, PublicStore } from '@/lib/boutique/site/resolve';
import type { BoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';

export type StoreCategoryOption = { id: string; name: string; _count: { products: number } };

export type StoreHeroProps = {
  store: PublicStore;
  categories: StoreCategoryOption[];
  base: string;
  dict: BoutiqueSiteDictionary;
};

export type StoreProductGridProps = {
  store: PublicStore;
  products: PublicProduct[];
  base: string;
  dict: BoutiqueSiteDictionary;
};
