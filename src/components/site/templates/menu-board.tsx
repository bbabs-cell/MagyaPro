import { cx } from '@/components/ui';
import { dishIcon } from '@/components/site/dish-icon';

export type BoardItem = { name: string; price: string };

/**
 * L'ardoise : ce qu'affiche le héros d'une vitrine quand le restaurant n'a pas
 * encore de photo de couverture.
 *
 * Avant elle, l'emplacement de la photo restait un aplat de la couleur du
 * restaurant — un grand rectangle vide au premier écran, le plus regardé du
 * site. L'ardoise le remplit avec ce que le restaurant a vraiment : ses plats
 * et leurs prix, présentés comme sur le tableau d'une salle. Rien n'y est
 * inventé, et la page dit déjà ce qu'on y mange avant la première photo.
 *
 * Sans aucun plat publié, il ne reste que l'initiale, sur la couleur du
 * restaurant : sobre, mais jamais un cadre vide.
 */
export function MenuBoard({
  name,
  items,
  title,
  primaryColor,
  className,
}: {
  name: string;
  items: BoardItem[];
  title: string;
  primaryColor: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        aria-hidden="true"
        className={cx('flex h-full w-full items-center justify-center', className)}
        style={{ backgroundColor: primaryColor }}
      >
        <span className="font-display text-[9rem] font-semibold leading-none text-white/85">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cx(
        'relative flex h-full w-full flex-col justify-center overflow-hidden bg-[#1f1d1a] px-7 py-8 text-[#f4efe6] sm:px-10',
        className,
      )}
    >
      {/* Grain de craie : un motif de points très discret, pas une texture
          d'image — rien à télécharger. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: primaryColor }}
      />
      <p
        className="relative text-xs font-semibold uppercase tracking-[0.3em]"
        style={{ color: primaryColor }}
      >
        {title}
      </p>
      <ul className="relative mt-6 space-y-4">
        {items.map((item) => (
          <li key={item.name} className="flex items-baseline gap-3">
            <span className="font-display text-lg leading-snug sm:text-xl">{item.name}</span>
            <span
              aria-hidden="true"
              className="min-w-6 flex-1 border-b border-dotted border-white/25"
            />
            <span className="shrink-0 text-sm font-semibold tabular-nums text-white/85">
              {item.price}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tuile d'un plat sans photo : dégradé de la couleur du restaurant, trame
 * légère, et une icône de cuisine déduite du nom du plat (`dishIcon`).
 *
 * Elle remplace une grosse initiale (« S », « V ») qui disait seulement qu'il
 * manquait une image. L'icône flotte doucement (`dish-float`), sauf pour qui
 * a demandé moins de mouvement.
 *
 * `tone="deep"` sert aux cartes dont le texte est posé en blanc sur l'image
 * (grille en mosaïque) : un fond foncé de la couleur du restaurant garde ce
 * texte lisible, là où un fond clair l'aurait effacé.
 */
export function DishPlaceholder({
  name,
  category,
  tone = 'soft',
}: {
  name: string;
  category?: string | null;
  tone?: 'soft' | 'deep';
}) {
  const DishIcon = dishIcon(name, category);
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background:
          tone === 'deep'
            ? 'radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--brand, #ff5e2e) 88%, #fff) 0%, color-mix(in srgb, var(--brand, #ff5e2e) 72%, #000) 70%)'
            : 'radial-gradient(120% 90% at 30% 15%, color-mix(in srgb, var(--brand, #ff5e2e) 22%, var(--surface, #fbf8f2)) 0%, color-mix(in srgb, var(--brand, #ff5e2e) 9%, var(--surface, #fbf8f2)) 65%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle, ${tone === 'deep' ? '#fff' : 'var(--brand, #ff5e2e)'} 1px, transparent 1.2px)`,
          backgroundSize: '16px 16px',
        }}
      />
      <DishIcon
        weight="duotone"
        className="dish-float relative h-[42%] max-h-28 w-auto"
        style={{
          color: tone === 'deep' ? 'rgba(255, 255, 255, 0.55)' : 'color-mix(in srgb, var(--brand, #ff5e2e) 70%, #000)',
        }}
      />
    </div>
  );
}
