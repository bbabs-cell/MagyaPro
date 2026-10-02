/**
 * Durée d'attente d'une commande, telle qu'on la lit sur l'écran de cuisine.
 *
 * L'écran affichait des minutes, sans plafond : une commande restée ouverte
 * quelques jours devenait « 22908 min ». C'est illisible précisément là où la
 * lecture doit être instantanée — la cuisine lit cet écran de loin, en
 * passant, et l'unité doit dire l'ordre de grandeur avant même le nombre.
 *
 * Trois paliers, chacun dans l'unité qu'une personne emploierait à voix
 * haute :
 *
 * - moins d'une heure : « 12 min » ;
 * - moins d'un jour : « 2 h 05 » — les minutes sur deux chiffres, comme une
 *   heure qu'on lit sur une pendule ;
 * - au-delà : « 16 j ». À ce stade le détail des heures n'aide plus personne,
 *   et le nombre doit surtout signaler qu'une commande a été oubliée.
 */
export function formatWait(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  if (safe < 60) return `${safe} min`;

  const hours = Math.floor(safe / 60);
  if (hours < 24) {
    const rest = safe % 60;
    return `${hours} h ${String(rest).padStart(2, '0')}`;
  }

  return `${Math.floor(hours / 24)} j`;
}
