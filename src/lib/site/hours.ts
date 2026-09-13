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

/**
 * Noms de jours du tableau de bord, qui reste en français.
 * Le site public, lui, passe par `dayNames(locale)`.
 */
export const DAY_NAMES = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const;

/**
 * Noms de jours dans la langue du visiteur, obtenus du navigateur/Node plutôt
 * que d'une liste recopiée par langue : `Intl` les connaît déjà, y compris en
 * arabe, et une liste de plus serait une liste de plus à maintenir.
 *
 * Le 4 janvier 1970 était un dimanche : les sept dates suivantes couvrent la
 * semaine dans l'ordre attendu par `dayOfWeek` (0 = dimanche).
 */
export function dayNames(locale: string): string[] {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  } catch {
    return [...DAY_NAMES];
  }
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(Date.UTC(1970, 0, 4 + day))),
  );
}

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

/**
 * Les six phrases affichées par la pastille « ouvert / fermé ». Elles sont
 * passées en paramètre plutôt que lues ici : `computeOpenState` est une
 * fonction pure, testée sans rendu ni cookie.
 */
export type OpenStateLabels = {
  hoursUnknown: string;
  closed: string;
  /** `{time}` — heure de fermeture du jour. */
  openUntil: string;
  /** `{time}` — heure d'ouverture du jour. */
  closedUntilToday: string;
  /** `{day}` et `{time}` — prochaine ouverture dans la semaine. */
  closedUntilDay: string;
  tomorrow: string;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function computeOpenState(
  hours: OpeningHourRow[],
  timezone: string,
  labels: OpenStateLabels,
  locale: string,
): OpenState {
  if (hours.length === 0) {
    return { isOpen: false, label: labels.hoursUnknown };
  }

  const { day, minutes } = localNow(timezone);
  const today = hours.find((hour) => hour.dayOfWeek === day);

  if (today && !today.isClosed) {
    const opens = toMinutes(today.opensAt);
    const closes = toMinutes(today.closesAt);

    if (minutes >= opens && minutes < closes) {
      return { isOpen: true, label: fill(labels.openUntil, { time: today.closesAt }) };
    }
    if (minutes < opens) {
      return { isOpen: false, label: fill(labels.closedUntilToday, { time: today.opensAt }) };
    }
  }

  // Fermé pour aujourd'hui : on cherche la prochaine ouverture dans la semaine.
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (day + offset) % 7;
    const next = hours.find((hour) => hour.dayOfWeek === nextDay);
    if (next && !next.isClosed) {
      const dayLabel = offset === 1 ? labels.tomorrow : dayNames(locale)[nextDay]!.toLowerCase();
      return {
        isOpen: false,
        label: fill(labels.closedUntilDay, { day: dayLabel, time: next.opensAt }),
      };
    }
  }

  return { isOpen: false, label: labels.closed };
}
