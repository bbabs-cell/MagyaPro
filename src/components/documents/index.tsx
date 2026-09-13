import type { ReactNode } from 'react';

import { formatMoney } from '@/lib/money';
import { cx } from '@/components/ui';

/**
 * Identité documentaire MagyaPro — tickets, reçus, factures.
 *
 * ## Pourquoi ce module existe
 *
 * Il y avait trois documents — la facture Boutique, le reçu de commande
 * Restaurant, le reçu d'abonnement — chacun avec sa mise en page écrite à la
 * main, et deux enveloppes d'impression identiques recopiées. Les trois
 * divergeaient déjà : seule la facture Boutique portait le logo du commerce et
 * le détail du règlement ; le reçu Restaurant ne disait ni comment ni si la
 * commande avait été payée.
 *
 * Le §22 demande l'inverse : **le même système pour Restaurant et Boutique**,
 * avec une identité reconnaissable. Les pièces sont donc ici, et les documents
 * les assemblent.
 *
 * ## Ce qui reste vrai à l'impression
 *
 * Un document est fait pour finir sur du papier ou dans un PDF. Les fonds
 * teintés et le filet de couleur demandés par le §22 disparaîtraient à
 * l'impression, que les navigateurs dépouillent par défaut : la classe
 * `print-keep-colors` les force à les conserver. Le reste — hiérarchie, graisses, filets sombres —
 * tient sans couleur, pour une impression en noir et blanc.
 */

/** Accent MagyaPro, figé ici : un document ne suit pas le thème de l'écran. */
const ACCENT = '#ff5e2e';

export type DocumentParty = {
  name: string;
  logoUrl?: string | null;
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  /** Numéro fiscal, registre de commerce — affiché tel quel s'il existe. */
  taxId?: string | null;
};

/**
 * En-tête : qui émet le document, de quel document il s'agit, et quand.
 *
 * Le logo du commerce n'apparaissait que sur la facture Boutique. Un reçu sans
 * logo ressemble à un brouillon, et c'est pourtant la seule trace que le
 * client emporte.
 */
export function DocumentHeader({
  issuer,
  kind,
  number,
  date,
  subline,
}: {
  issuer: DocumentParty;
  /** « Facture », « Reçu », « Bon de livraison ». */
  kind: string;
  number: string;
  date: Date;
  /** Précision sous le numéro — « Vente n°42 ». */
  subline?: string;
}) {
  return (
    <header>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {issuer.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo du commerce, déjà dimensionné
            <img
              src={issuer.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink">{issuer.name}</p>
            {issuer.addressLine && (
              <p className="text-sm text-ink-muted">{issuer.addressLine}</p>
            )}
            {(issuer.city || issuer.country) && (
              <p className="text-sm text-ink-muted">
                {[issuer.city, issuer.country].filter(Boolean).join(', ')}
              </p>
            )}
            {issuer.phone && <p className="text-sm text-ink-muted">{issuer.phone}</p>}
            {issuer.taxId && <p className="mt-0.5 text-xs text-ink-faint">{issuer.taxId}</p>}
          </div>
        </div>

        <div className="shrink-0 text-end">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: ACCENT }}
          >
            {kind}
          </p>
          <p className="text-lg font-bold text-ink">{number}</p>
          <p className="text-sm text-ink-muted">
            {date.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          {subline && <p className="mt-0.5 text-xs text-ink-faint">{subline}</p>}
        </div>
      </div>

      {/* Le filet de couleur est la seule marque MagyaPro du document : le
          reste appartient au commerce, dont c'est le papier à en-tête. */}
      <div className="print-keep-colors mt-4 h-1 rounded-full" style={{ backgroundColor: ACCENT }} />
    </header>
  );
}

/** Bloc « Client » — ou tout autre partie nommée du document. */
export function DocumentParty({
  label,
  name,
  lines = [],
}: {
  label: string;
  name: string;
  lines?: Array<string | null | undefined>;
}) {
  return (
    <section className="mt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-ink">{name}</p>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="text-sm text-ink-muted">
          {line}
        </p>
      ))}
    </section>
  );
}

export type DocumentLine = {
  id: string;
  label: string;
  /** Déclinaison, variante, précision — affichée en gris à la suite du nom. */
  detail?: string | null;
  /** Déjà formatée : les quantités n'ont pas la même unité d'un produit à l'autre. */
  quantity: string;
  unitPrice: number;
  total: number;
};

/** Le corps du document : ce qui a été vendu, en quelle quantité, à quel prix. */
export function DocumentLines({
  lines,
  currency,
}: {
  lines: DocumentLine[];
  currency: string;
}) {
  return (
    // Quatre colonnes de prix ne rentrent pas toujours sur un téléphone
    // étroit. Un document ne peut pas être empilé comme un tableau de bord —
    // c'est une facture, elle garde sa forme — il défile donc
    // horizontalement plutôt que de pousser la page entière.
    //
    // `overflow-x` n'a aucun effet à l'impression : le contenu y est paginé,
    // pas contraint par une fenêtre. La mise en page papier est intacte.
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-start text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <th className="py-2 text-start font-semibold">Article</th>
            <th className="py-2 text-end font-semibold">Qté</th>
            <th className="py-2 text-end font-semibold">Prix unitaire</th>
            <th className="py-2 text-end font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            // `break-inside` : une ligne d'article ne doit pas être coupée en
            // deux par un saut de page.
            <tr key={line.id} className="break-inside-avoid border-b border-surface-border">
              <td className="py-2.5 pe-3">
                <span className="text-ink">{line.label}</span>
                {line.detail && <span className="text-ink-muted"> · {line.detail}</span>}
              </td>
              <td className="py-2.5 text-end tabular-nums">{line.quantity}</td>
              <td className="py-2.5 text-end tabular-nums text-ink-muted">
                {formatMoney(line.unitPrice, currency)}
              </td>
              <td className="py-2.5 text-end font-medium tabular-nums">
                {formatMoney(line.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DocumentTotalRow = {
  label: string;
  amount: number;
  /** Affiché en petit sous le total — la part de TVA comprise, par exemple. */
  muted?: boolean;
  /** Préfixé d'un moins : remise, avoir. */
  negative?: boolean;
  /** Remplace le montant par un mot — « Offerte ». */
  text?: string;
};

/** Les totaux, sur fond teinté pour être trouvés d'un coup d'œil. */
export function DocumentTotals({
  rows,
  total,
  currency,
  after,
}: {
  rows: DocumentTotalRow[];
  total: number;
  currency: string;
  /** Lignes affichées sous le total, en petit. */
  after?: DocumentTotalRow[];
}) {
  return (
    <div className="mt-5 flex justify-end">
      <div className="print-keep-colors w-full max-w-xs rounded-xl bg-surface-sunken p-4">
        <dl className="space-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="tabular-nums">
                {row.text ??
                  `${row.negative ? '−' : ''}${formatMoney(row.amount, currency)}`}
              </dd>
            </div>
          ))}

          <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-2">
            <dt className="text-base font-bold text-ink">Total</dt>
            <dd className="text-base font-bold tabular-nums text-ink">
              {formatMoney(total, currency)}
            </dd>
          </div>

          {after?.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 text-xs text-ink-faint">
              <dt>{row.label}</dt>
              <dd className="tabular-nums">
                {row.text ?? formatMoney(row.amount, currency)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export type DocumentPayment = { id: string; label: string; detail?: string | null; amount: number };

/**
 * Le règlement — ce que le client vient vérifier sur un reçu.
 *
 * « Est-ce que j'ai payé, comment, et reste-t-il quelque chose » est la
 * question à laquelle un reçu doit répondre, et celle qui fait foi si elle se
 * pose plus tard. Le reçu Restaurant ne la traitait pas du tout.
 */
export function DocumentPayments({
  payments,
  remaining,
  currency,
  emptyLabel,
}: {
  payments: DocumentPayment[];
  /** Reste dû. Zéro ou moins signifie soldé. */
  remaining: number;
  currency: string;
  /** Ce qu'on écrit quand rien n'a été versé. */
  emptyLabel?: string;
}) {
  const settled = remaining <= 0;

  return (
    <section className="mt-8 break-inside-avoid border-t border-surface-border pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Règlement
      </p>

      {payments.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {payments.map((payment) => (
            <li key={payment.id} className="flex justify-between gap-4">
              <span>
                {payment.label}
                {payment.detail && <span className="text-ink-muted"> · {payment.detail}</span>}
              </span>
              <span className="tabular-nums">{formatMoney(payment.amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        emptyLabel && <p className="mt-2 text-sm text-ink-muted">{emptyLabel}</p>
      )}

      <p
        className={cx(
          'print-keep-colors mt-3 inline-block rounded-md px-2.5 py-1 text-sm font-semibold',
          settled ? 'bg-state-ok-soft text-state-ok' : 'bg-state-warn-soft text-state-warn',
        )}
      >
        {settled ? 'Payée' : `Reste à payer : ${formatMoney(remaining, currency)}`}
      </p>
    </section>
  );
}

/** Pied de page — la mention d'origine, discrète. */
export function DocumentFooter({ issuerName }: { issuerName: string }) {
  return (
    <p className="mt-10 text-center text-xs text-ink-faint">
      Généré par MagyaPro pour {issuerName}
    </p>
  );
}

/**
 * Barre d'aperçu, masquée à l'impression : elle explique ce qu'on regarde et
 * porte le bouton d'impression.
 */
export function DocumentToolbar({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-sm text-ink-muted">{hint}</p>
      {children}
    </div>
  );
}
