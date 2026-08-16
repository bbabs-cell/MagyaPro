'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * Widget anti-robot Cloudflare Turnstile, en rendu explicite (le script est
 * chargé une fois puis appelé via `window.turnstile.render`) plutôt qu'en
 * mode implicite : ça évite de dépendre d'un callback global attaché à
 * `window` et fonctionne proprement même si le composant est démonté puis
 * remonté (navigation client entre connexion et inscription, par exemple).
 */
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => setScriptReady(true));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) return;

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null),
    });

    return () => {
      window.turnstile?.reset(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onToken` change de référence à chaque rendu du parent, sans conséquence sur ce montage unique du widget.
  }, [scriptReady, siteKey]);

  return <div ref={containerRef} />;
}
