'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un chiffre de tableau de bord qui défile jusqu'à sa valeur, à l'arrivée sur
 * la page (skill « animations vivantes »).
 *
 * La valeur arrive **déjà formatée** — « 113 600 F CFA », « 9 », « 11,3 % » —
 * parce que c'est ainsi que les pages la calculent, avec la devise et les
 * séparateurs du commerce. Plutôt que d'exiger un nombre brut partout, on
 * anime le seul nombre entier que contient le texte, et l'on garde tout le
 * reste tel quel.
 *
 * Trois garanties, sans lesquelles l'animation serait un mensonge :
 *
 * - **La dernière image est le texte exact reçu**, caractère pour caractère.
 *   Pas une reconstruction : la chaîne d'origine.
 * - **Rendu serveur = valeur finale.** Le HTML envoyé porte le vrai chiffre ;
 *   une page sans JavaScript, imprimée ou lue par un lecteur d'écran ne voit
 *   jamais un zéro.
 * - **Rien n'est animé quand le doute est permis** : un nombre à virgule, un
 *   texte sans chiffre ou avec plusieurs nombres (« 3 / 12 »), ou une personne
 *   qui a demandé moins de mouvement — la valeur s'affiche directement.
 */
const INTEGER = /\d{1,3}(?:[\s  ]\d{3})+|\d+/g;

function parse(text: string): { value: number; start: number; end: number; group: string } | null {
  const matches = [...text.matchAll(INTEGER)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const start = match.index ?? 0;
  const end = start + match[0].length;
  // Une virgule ou un point collé au nombre : c'est un décimal, on n'y touche pas.
  if (/[.,]\d/.test(text.slice(end, end + 2))) return null;
  const group = /[\s  ]/.exec(match[0])?.[0] ?? ' ';
  return { value: Number(match[0].replace(/\D/g, '')), start, end, group };
}

function format(value: number, group: string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

export function AnimatedValue({ value, durationMs = 900 }: { value: string; durationMs?: number }) {
  const [shown, setShown] = useState(value);
  const played = useRef(false);

  useEffect(() => {
    const parsed = parse(value);
    if (!parsed || parsed.value === 0 || played.current) {
      setShown(value);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    played.current = true;
    const before = value.slice(0, parsed.start);
    const after = value.slice(parsed.end);
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      if (t === 1) {
        setShown(value);
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(`${before}${format(Math.round(parsed.value * eased), parsed.group)}${after}`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [value, durationMs]);

  // Chiffres à chasse fixe **pendant** le défilement seulement, pour que le
  // nombre ne tremble pas en largeur. Au repos, la chasse normale : en
  // Manrope, la chasse fixe élargit le « 1 », et « 111 300 » se lisait
  // « 1 1 1 300 ». Un chiffre seul dans sa carte n'a pas de colonne à tenir.
  return <span className={shown === value ? undefined : 'tabular-nums'}>{shown}</span>;
}
