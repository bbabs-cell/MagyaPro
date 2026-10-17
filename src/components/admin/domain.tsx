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
