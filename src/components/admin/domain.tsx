/**
 * Couleurs de domaine du Super Admin — une couleur, un sujet.
 *
 * - braise : MagyaPro Restaurant ;
 * - or : MagyaPro Boutique ;
 * - violet : les abonnements — plans, paiements, essais, recette de MagyaPro ;
 * - bleu : les comptes utilisateurs ;
 * - rose : la communication — annonces, notifications, emails.
 *
 * Le vert, l'ambre et le rouge ne sont pas ici : ils disent un état (sain, à
 * surveiller, en défaut), jamais un sujet. Ce qui n'appartient à aucun domaine
 * (vue d'ensemble, journal, réglages, images) reste neutre — une couleur posée
 * sans sujet ne voudrait rien dire, et affaiblirait toutes les autres.
 *
 * Les valeurs vivent dans `admin/theme-root.tsx` (une par thème) ; ces tables
 * ne donnent que des noms de classes complets, que Tailwind sait retrouver.
 */
export type AdminDomain = 'resto' | 'boutique' | 'abo' | 'users' | 'comm';

export const DOMAIN_DOT: Record<AdminDomain, string> = {
  resto: 'bg-domain-resto',
  boutique: 'bg-domain-boutique',
  abo: 'bg-domain-abo',
  users: 'bg-domain-users',
  comm: 'bg-domain-comm',
};

export const DOMAIN_TEXT: Record<AdminDomain, string> = {
  resto: 'text-domain-resto',
  boutique: 'text-domain-boutique',
  abo: 'text-domain-abo',
  users: 'text-domain-users',
  comm: 'text-domain-comm',
};

/** Pastille d'icône : fond teinté et trait de la couleur du domaine. */
export const DOMAIN_CHIP: Record<AdminDomain, string> = {
  resto: 'bg-domain-resto/15 text-domain-resto',
  boutique: 'bg-domain-boutique/15 text-domain-boutique',
  abo: 'bg-domain-abo/15 text-domain-abo',
  users: 'bg-domain-users/15 text-domain-users',
  comm: 'bg-domain-comm/15 text-domain-comm',
};

/** Titre d'écran ou intertitre, précédé de la pastille de son domaine. */
export function DomainHeading({
  as: Tag = 'h2',
  id,
  domain,
  children,
  className = 'text-sm font-medium',
}: {
  as?: 'h1' | 'h2';
  id?: string;
  domain?: AdminDomain;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag id={id} className={`flex items-center gap-2 ${className}`}>
      {domain && (
        <span
          aria-hidden="true"
          className={`shrink-0 rounded-full ${Tag === 'h1' ? 'h-2.5 w-2.5' : 'h-2 w-2'} ${DOMAIN_DOT[domain]}`}
        />
      )}
      {children}
    </Tag>
  );
}

const PANEL: Record<'resto' | 'boutique', { frame: string; bar: string }> = {
  resto: { frame: 'border-domain-resto/40 bg-domain-resto/[0.06]', bar: 'bg-domain-resto' },
  boutique: { frame: 'border-domain-boutique/40 bg-domain-boutique/[0.06]', bar: 'bg-domain-boutique' },
};

/**
 * Panneau d'un produit sur la vue d'ensemble : Restaurant en braise, Boutique
 * en or. Les deux parties ont les mêmes grilles, trait pour trait ; un simple
 * filet entre elles ne disait pas assez où l'une finissait et l'autre
 * commençait. Le cadre teinté et la barre de couleur le disent d'un coup
 * d'œil, même en faisant défiler vite.
 */
export function DomainPanel({
  domain,
  title,
  description,
  icon,
  children,
}: {
  domain: 'resto' | 'boutique';
  title: string;
  description: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`relative mt-10 overflow-hidden rounded-3xl border p-4 pt-6 sm:p-6 sm:pt-7 ${PANEL[domain].frame}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${PANEL[domain].bar}`} />
      <div className="flex items-center gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${DOMAIN_CHIP[domain]}`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className={`text-lg font-semibold tracking-tight ${DOMAIN_TEXT[domain]}`}>{title}</h2>
          <p className="text-sm text-fg/60">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
