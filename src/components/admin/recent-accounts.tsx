import Link from 'next/link';

import { ExcludedTag, StatusPill } from '@/components/admin/state-badge';

/**
 * Derniers restaurants ou dernières boutiques inscrits, sur la vue d'ensemble.
 *
 * Chaque couleur garde son sens habituel du Super Admin :
 * - la vignette aux initiales porte la couleur du **domaine** (braise pour
 *   Restaurant, or pour Boutique) : on sait de quel produit on parle ;
 * - le liseré gauche porte l'**état** du compte (vert en ligne, rouge
 *   suspendu, neutre brouillon), comme les listes des tableaux de bord.
 *
 * Un compte de démonstration ou de test est estompé : il ne compte dans aucun
 * chiffre, il ne doit pas non plus attirer l'œil comme un vrai client.
 */

export type RecentAccount = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  isDemo: boolean;
  isTest: boolean;
  /** Commandes (restaurant) ou ventes (boutique). */
  activity: number;
};

const RAIL: Record<string, string> = {
  ACTIVE: 'var(--state-ok)',
  SUSPENDED: 'var(--state-bad)',
};

const DOMAIN_TILE = {
  resto: 'bg-domain-resto/15 text-domain-resto',
  boutique: 'bg-domain-boutique/15 text-domain-boutique',
} as const;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

/** « aujourd'hui », « hier », « il y a 5 j », puis la date. */
function createdLabel(date: Date, now: number): string {
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return "créé aujourd'hui";
  if (days === 1) return 'créé hier';
  if (days < 30) return `créé il y a ${days} j`;
  return `créé le ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
}

export function RecentAccounts({
  accounts,
  domain,
  hrefBase,
  activityLabel,
  emptyLabel,
}: {
  accounts: RecentAccount[];
  domain: keyof typeof DOMAIN_TILE;
  /** `/admin/restaurants` ou `/admin/boutiques`. */
  hrefBase: string;
  /** Singulier et pluriel : `['commande', 'commandes']`. */
  activityLabel: [string, string];
  emptyLabel: string;
}) {
  const now = Date.now();

  return (
    <ul className="stagger mt-3 overflow-hidden rounded-2xl border border-fg/10">
      {accounts.length === 0 && <li className="p-3.5 text-sm text-fg/60">{emptyLabel}</li>}
      {accounts.map((account) => {
        const excluded = account.isDemo || account.isTest;
        return (
          <li key={account.id} className="border-b border-fg/10 last:border-0">
            <Link
              href={`${hrefBase}/${account.id}`}
              className={`group flex items-center gap-2.5 py-3 pl-2.5 pr-3 sm:gap-3 sm:pl-3 sm:pr-3.5 transition-colors hover:bg-fg/5 ${
                excluded ? 'opacity-70 hover:opacity-100' : ''
              }`}
              style={{
                borderLeft: `3px solid ${RAIL[account.status] ?? 'color-mix(in srgb, var(--fg) 20%, transparent)'}`,
              }}
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm ${DOMAIN_TILE[domain]}`}
              >
                {initials(account.name)}
              </span>

              <span className="min-w-0 flex-1">
                {/* L'étiquette « démo » / « test » reste visible : dans le
                    texte tronqué, elle disparaissait la première. */}
                <span className="flex min-w-0 items-center">
                  <span className="truncate font-medium">{account.name}</span>
                  <span className="shrink-0">
                    <ExcludedTag isDemo={account.isDemo} isTest={account.isTest} />
                  </span>
                </span>
                <span className="block truncate text-xs text-fg/60">
                  {account.slug} · {createdLabel(account.createdAt, now)}
                </span>
              </span>

              {/* L'activité, en chiffre lisible : c'est ce qu'on cherche en
                  parcourant la liste — qui a déjà commencé à vendre. */}
              <span className="hidden shrink-0 text-right sm:block">
                <span className={`block text-sm font-semibold tabular-nums ${account.activity > 0 ? '' : 'text-fg/40'}`}>
                  {account.activity}
                </span>
                <span className="block text-[11px] text-fg/50">
                  {account.activity > 1 ? activityLabel[1] : activityLabel[0]}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <StatusPill status={account.status} />
                {/* Sur téléphone, l'activité passe sous l'état. */}
                <span className="text-[11px] tabular-nums text-fg/55 sm:hidden">
                  {account.activity} {account.activity > 1 ? activityLabel[1] : activityLabel[0]}
                </span>
              </span>

              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="hidden h-4 w-4 shrink-0 text-fg/30 transition-transform group-hover:translate-x-0.5 group-hover:text-fg/60 sm:block"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
