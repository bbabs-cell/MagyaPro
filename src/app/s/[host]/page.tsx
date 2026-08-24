import { notFound } from 'next/navigation';

import { loadPublicCategories, loadPublicProducts, resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { getBoutiqueSiteDictionary } from '@/lib/i18n/boutique-site';
import { storeTemplateRenderer } from '@/components/site-store/templates';

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  const [categories, products] = await Promise.all([
    loadPublicCategories(store.id),
    loadPublicProducts(store.id),
  ]);
  const base = sitePathBase(host);
  const dict = getBoutiqueSiteDictionary(store.language);
  const { Hero, ProductGrid } = storeTemplateRenderer(store.templateKey);

  return (
    <>
      <Hero store={store} categories={categories} base={base} dict={dict} />
      <ProductGrid store={store} products={products} base={base} dict={dict} />
    </>
  );
}
