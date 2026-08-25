'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Bandeau de consentement pour le site vitrine MagyaPro (jamais les sites
 * publics des tenants, qui ont leur propre bandeau et leurs propres
 * réglages). Charge Google Analytics et le Meta Pixel uniquement après un
 * choix explicite « Accepter » — jamais par défaut, et jamais si l'un ou
 * l'autre n'est configuré (`metaPixelId`/`gaMeasurementId` absents).
 */
const CONSENT_STORAGE_KEY = 'magyapro:analytics-consent';
type Consent = 'accepted' | 'rejected';

function readStoredConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch {
    // Stockage indisponible (navigation privée) : traité comme absence de
    // choix, le bandeau reste affiché sans bloquer la page.
    return null;
  }
}

export function CookieConsent({
  metaPixelId = null,
  gaMeasurementId = null,
}: {
  /** IDs du site vitrine MagyaPro lui-même — jamais ceux d'un tenant. */
  metaPixelId?: string | null;
  gaMeasurementId?: string | null;
}) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setReady(true);
  }, []);

  function choose(value: Consent) {
    setConsent(value);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
      // Le choix ne sera pas mémorisé (navigation privée) : sans
      // conséquence, le bandeau réapparaîtra simplement à la prochaine visite.
    }
  }

  return (
    <>
      {ready && consent === 'accepted' && (
        <>
          {gaMeasurementId && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
                strategy="afterInteractive"
              />
              <Script id="ga4-init" strategy="afterInteractive">
                {`window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaMeasurementId}');`}
              </Script>
            </>
          )}
          {metaPixelId && (
            <Script id="meta-pixel-init" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');`}
            </Script>
          )}
        </>
      )}

      {ready && consent === null && (
        <div
          role="region"
          aria-label="Consentement aux cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border bg-surface p-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]"
        >
          <div className="container-page flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">
              Ce site utilise des cookies strictement nécessaires à son
              fonctionnement, et, si vous les acceptez, des cookies de mesure
              d&apos;audience et publicitaires pour comprendre comment le site
              est utilisé.{' '}
              <Link href="/confidentialite" className="underline underline-offset-4 hover:text-ink">
                En savoir plus
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => choose('rejected')}
                className="inline-flex h-10 items-center rounded-lg border border-surface-border px-4 text-sm font-medium hover:bg-surface-sunken"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={() => choose('accepted')}
                className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-surface"
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
