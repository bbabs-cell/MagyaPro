/**
 * Lecture des options figées sur une ligne de commande.
 *
 * Les options choisies par le client sont enregistrées en JSON au moment de la
 * commande — `[{ groupName, optionName, priceDelta }]` — pour que la commande
 * reste fidèle à ce qui a été demandé, même si la carte change ensuite.
 *
 * Du JSON n'a pas de type : chaque écran qui l'affichait refaisait sa propre
 * conversion, à coups de `as`. Une conversion sans vérification n'échoue pas,
 * elle produit `undefined` là où on attendait un texte — et en cuisine, une
 * option qui s'affiche vide vaut une option qu'on ne voit pas.
 *
 * Ce module lit la donnée pour de bon : ce qui n'a pas la forme attendue est
 * écarté, et le reste est sûr à afficher.
 */

export type OptionSnapshot = {
  /** Nom du groupe d'options — « Cuisson », « Accompagnement ». */
  groupName: string;
  /** Nom de l'option retenue — « Bien cuit », « Sans piment ». */
  optionName: string;
  /** Supplément appliqué, en unité mineure. Peut être nul ou négatif. */
  priceDelta: number;
};

function isSnapshot(value: unknown): value is OptionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.groupName === 'string' &&
    typeof candidate.optionName === 'string' &&
    typeof candidate.priceDelta === 'number'
  );
}

/** Options exploitables d'une ligne de commande. Liste vide si rien n'est lisible. */
export function readOptions(raw: unknown): OptionSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSnapshot);
}

/**
 * Résumé d'une ligne pour la cuisine : « Cuisson : bien cuit · Sans piment ».
 *
 * Le nom du groupe est omis quand il n'apporte rien — « Suppléments :
 * fromage » se lit aussi bien « fromage », et une fiche de cuisine se lit en
 * une seconde, de loin.
 */
export function describeOptions(options: OptionSnapshot[]): string {
  return options
    .map((option) =>
      option.groupName.trim() && !option.optionName.toLowerCase().includes(option.groupName.toLowerCase())
        ? `${option.groupName} : ${option.optionName}`
        : option.optionName,
    )
    .join(' · ');
}
