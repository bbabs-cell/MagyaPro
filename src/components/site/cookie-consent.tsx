'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Bandeau d'information cookies. Magyapro ne dépose aujourd'hui que des
 * cookies strictement nécessaires (session, préférence de thème) — pas de
 * mesure d'audience ni de publicité — donc un simple avis suffit plutôt
 * qu'un choix accepter/refuser granulaire. À revoir si un outil de mesure
 * d'audience est ajouté un jour.
 */
const CONSENT_STORAGE_KEY = 'magyapro:cookie-notice-seen';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // Stockage indisponible (navigation privée) : on n'affiche pas le
      // bandeau plutôt que de le montrer à chaque page.
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, '1');
    } catch {
      // Le bandeau reviendra à la prochaine visite sans stockage — sans
      // conséquence, ce n'est qu'un rappel informatif.
    }
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border bg-surface p-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]"
    >
      <div className="container-page flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Ce site utilise des cookies strictement nécessaires à son
          fonctionnement (connexion, préférences d&apos;affichage). Aucun
          cookie de mesure d&apos;audience ou de publicité.{' '}
          <Link href="/confidentialite" className="underline underline-offset-4 hover:text-ink">
            En savoir plus
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-10 shrink-0 items-center rounded-lg bg-ink px-4 text-sm font-medium text-surface"
        >
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
