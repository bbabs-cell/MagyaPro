/**
 * Horaires d'ouverture.
 *
 * Le calcul se fait dans le fuseau du restaurant, pas dans celui du serveur ni
 * dans celui du visiteur : un client à Paris qui consulte un restaurant à
 * Abidjan doit voir l'état réel de la maison.
 */

export type OpeningHourRow = {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

export const DAY_NAMES = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const;

/** Jour et heure locale du restaurant, à partir de son fuseau IANA. */
function localNow(timezone: string): { day: number; minutes: number } {
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    // Fuseau invalide en base : on retombe sur l'heure du serveur plutôt que
    // de faire échouer le rendu de la page publique.
    return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return { day: weekdayMap[weekday] ?? 0, minutes: hour * 60 + minute };
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export type OpenState = {
  isOpen: boolean;
  /** Phrase courte affichée sur le site public. */
  label: string;
};

export function computeOpenState(
  hours: OpeningHourRow[],
  timezone: string,
): OpenState {
  if (hours.length === 0) {
    return { isOpen: false, label: 'Horaires non renseignés' };
  }

  const { day, minutes } = localNow(timezone);
  const today = hours.find((hour) => hour.dayOfWeek === day);

  if (today && !today.isClosed) {
    const opens = toMinutes(today.opensAt);
    const closes = toMinutes(today.closesAt);

    if (minutes >= opens && minutes < closes) {
      return { isOpen: true, label: `Ouvert · ferme à ${today.closesAt}` };
    }
    if (minutes < opens) {
      return { isOpen: false, label: `Fermé · ouvre à ${today.opensAt}` };
    }
  }

  // Fermé pour aujourd'hui : on cherche la prochaine ouverture dans la semaine.
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (day + offset) % 7;
    const next = hours.find((hour) => hour.dayOfWeek === nextDay);
    if (next && !next.isClosed) {
      const dayLabel = offset === 1 ? 'demain' : DAY_NAMES[nextDay]!.toLowerCase();
      return { isOpen: false, label: `Fermé · ouvre ${dayLabel} à ${next.opensAt}` };
    }
  }

  return { isOpen: false, label: 'Fermé' };
}
