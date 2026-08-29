import { cx } from '@/components/ui';

/**
 * Le ticket imprimé — élément signature des deux pages de présentation.
 *
 * C'est le seul objet physique que ces deux produits fabriquent vraiment : la
 * boutique imprime un ticket de caisse, la cuisine imprime un bon de commande.
 * Même papier étroit, même monospace, même bord déchiré. D'où la parenté de
 * marque : les deux pages montrent le même geste, pas la même illustration.
 *
 * Il remplace la maquette de navigateur qui ouvrait les deux pages — trois
 * pastilles grises et un cadre, motif qu'on retrouve sur la moitié des sites
 * de logiciels et qui ne dit rien du métier.
 *
 * Le contenu fait l'argument à la place du texte publicitaire. Sur Boutique,
 * le ticket montre une vente où le même produit part en bouteilles ET en
 * carton, à deux prix indépendants : c'est précisément ce qu'un logiciel de
 * facturation ne sait pas faire, montré plutôt qu'affirmé.
 *
 * Aucune animation, aucun JavaScript : un ticket est imprimé, il ne bouge pas.
 */

export type TicketLine =
  | { kind: 'item'; label: string; detail?: string; amount?: string }
  | { kind: 'rule' }
  | { kind: 'total'; label: string; amount: string }
  | { kind: 'note'; text: string };

export function Ticket({
  header,
  meta,
  lines,
  footer,
  tone,
  className,
}: {
  /** Nom de l'établissement, en tête du ticket. */
  header: string;
  /** Numéro, table, heure — la ligne d'identification sous l'en-tête. */
  meta: string;
  lines: TicketLine[];
  /** Mention finale : « MERCI DE VOTRE VISITE », « À PRÉPARER ». */
  footer: string;
  /**
   * `kraft` — papier ocre, encre brune : Boutique.
   * `blanc` — papier froid, encre ardoise : Restaurant.
   * Deux papiers, un seul objet : c'est là que les produits se distinguent.
   */
  tone: 'kraft' | 'blanc';
  className?: string;
}) {
  const kraft = tone === 'kraft';

  return (
    <div
      // Rôle décoratif : le ticket illustre, il ne remplace pas le texte de la
      // page. Le lecteur d'écran l'ignore plutôt que d'épeler des colonnes de
      // chiffres hors contexte.
      aria-hidden="true"
      className={cx(
        'relative w-full max-w-[22rem] select-none font-mono text-[13px] leading-[1.7]',
        // Ombre portée longue et douce : le ticket est posé sur la page, pas
        // encastré dedans.
        'shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]',
        kraft ? 'bg-[#f0e3cd] text-[#3b2a1a]' : 'bg-[#f7f8fa] text-[#18202f]',
        className,
      )}
      style={{
        // Bord déchiré, en haut et en bas. Un dégradé conique répété dessine
        // les dents ; `mask` les découpe réellement dans l'élément, sans image
        // ni SVG à charger.
        maskImage:
          'radial-gradient(circle at 6px -1px, transparent 6px, black 6.5px), radial-gradient(circle at 6px calc(100% + 1px), transparent 6px, black 6.5px)',
        maskSize: '12px 100%, 12px 100%',
        maskRepeat: 'repeat-x, repeat-x',
        maskPosition: 'top, bottom',
        WebkitMaskImage:
          'radial-gradient(circle at 6px -1px, transparent 6px, black 6.5px), radial-gradient(circle at 6px calc(100% + 1px), transparent 6px, black 6.5px)',
        WebkitMaskSize: '12px 100%, 12px 100%',
        WebkitMaskRepeat: 'repeat-x, repeat-x',
        WebkitMaskPosition: 'top, bottom',
      }}
    >
      <div className="px-6 py-8">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.28em]">{header}</p>
        <p className={cx('mt-1 text-center text-[11px]', kraft ? 'text-[#3b2a1a]/55' : 'text-[#18202f]/55')}>
          {meta}
        </p>

        <div className="mt-5 space-y-1">
          {lines.map((line, index) => {
            if (line.kind === 'rule') {
              return (
                <div
                  key={index}
                  className={cx(
                    'my-2.5 border-t border-dashed',
                    kraft ? 'border-[#3b2a1a]/25' : 'border-[#18202f]/20',
                  )}
                />
              );
            }

            if (line.kind === 'total') {
              return (
                <div key={index} className="flex items-baseline justify-between gap-4 font-medium">
                  <span className="uppercase tracking-[0.12em]">{line.label}</span>
                  <span className="tabular-nums">{line.amount}</span>
                </div>
              );
            }

            if (line.kind === 'note') {
              return (
                <p
                  key={index}
                  className={cx(
                    'text-center text-[11px] uppercase tracking-[0.28em]',
                    kraft ? 'text-[#3b2a1a]/60' : 'text-[#18202f]/60',
                  )}
                >
                  {line.text}
                </p>
              );
            }

            return (
              <div key={index}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate">{line.label}</span>
                  {line.amount ? <span className="tabular-nums">{line.amount}</span> : null}
                </div>
                {line.detail ? (
                  <p className={cx('pl-4 text-[12px]', kraft ? 'text-[#3b2a1a]/60' : 'text-[#18202f]/60')}>
                    {line.detail}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.28em]">{footer}</p>
      </div>
    </div>
  );
}
