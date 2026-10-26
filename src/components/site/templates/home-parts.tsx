import { cx } from '@/components/ui';
import { DishPlaceholder } from '@/components/site/templates/menu-board';
import type { MenuProduct } from '@/components/site/templates';
import type { ElegantHomeData } from '@/components/site/templates/elegant-home';

/**
 * Pièces communes aux pages d'accueil d'une seule page (« Moderne »,
 * « Africain premium », « Fast-food »).
 *
 * Chacune garde sa mise en page et son caractère ; seuls les briques sans
 * style propre se partagent ici : la photo d'un plat (ou son visuel de
 * remplacement), le titre qui se révèle mot à mot, les horaires dans l'ordre
 * de la semaine.
 */

export type PopularProduct = MenuProduct & {
  categoryName: string;
  /** Quantité commandée sur les 30 derniers jours ; 0 quand on retombe sur la sélection du restaurant. */
  orderedCount: number;
};

/** Données d'une page d'accueil d'une seule page avec les plats les plus commandés. */
export type PopularHomeData = ElegantHomeData & {
  popular: PopularProduct[];
  reservationHref: string | null;
};

export function DishImage({
  product,
  className,
  imageClassName,
  priority = false,
}: {
  product: Pick<MenuProduct, 'name' | 'imageUrl'> & { categoryName?: string };
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={cx('relative overflow-hidden', className)}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image de tenant, hôte arbitraire
        <img
          src={product.imageUrl}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cx(
            'absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105',
            imageClassName,
          )}
        />
      ) : (
        <DishPlaceholder name={product.name} category={product.categoryName} />
      )}
    </div>
  );
}

/** Le nom du restaurant, mot par mot, pour l'entrée en cascade du titre. */
export function KineticTitle({ text, className }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <h1 className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="sd-word me-[0.22em]" style={{ '--i': index } as React.CSSProperties}>
            {word}
          </span>
        ))}
      </span>
    </h1>
  );
}

/** Horaires du lundi au dimanche (la base les range du dimanche, jour 0). */
export function weekOrder<T extends { dayOfWeek: number }>(hours: T[]): T[] {
  return [...hours].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));
}

/** Numéro WhatsApp réduit à ses chiffres, comme l'attend `wa.me`. */
export function whatsappDigits(number: string | null): string | null {
  const digits = number?.replace(/[^\d]/g, '') ?? '';
  return digits.length > 0 ? digits : null;
}
