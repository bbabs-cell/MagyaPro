'use client';

/**
 * Navigation par catégorie : une barre horizontale défilante, collée sous
 * l'en-tête. Sur mobile, faire défiler une longue carte pour retrouver les
 * desserts est le principal point de friction ; ces ancres l'évitent.
 */
export function CategoryNav({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  if (categories.length < 2) return null;

  return (
    <nav
      aria-label="Catégories du menu"
      className="sticky top-16 z-30 -mx-4 mt-5 border-b border-surface-border bg-surface/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3"
    >
      <ul className="flex gap-2 overflow-x-auto">
        {categories.map((category) => (
          <li key={category.id}>
            <a
              href={`#${category.id}`}
              className="inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
