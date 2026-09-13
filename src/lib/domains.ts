import { resolveTxt } from 'node:dns/promises';

import { env, rootHostname } from '@/lib/env';

/**
 * Vérification des domaines personnalisés.
 *
 * La preuve de propriété repose sur un enregistrement TXT : seul quelqu'un qui
 * contrôle la zone DNS du domaine peut le créer. Une simple requête HTTP vers
 * le domaine ne prouverait rien — n'importe qui peut faire pointer un CNAME.
 *
 * ## Ce que la vérification prouve, et ce qu'elle ne fait pas
 *
 * Elle établit que le restaurateur possède bien le domaine. Elle **ne rend pas
 * le site joignable pour autant** : l'adresse doit encore être déclarée auprès
 * de l'hébergeur, faute de quoi un visiteur tombe sur une erreur de
 * l'hébergeur et non sur le restaurant. Magyapro ne fait pas cette déclaration
 * automatiquement aujourd'hui — les domaines vérifiés en attente sont listés
 * sur la vue d'ensemble de l'administration, pour être traités à la main.
 *
 * Le certificat TLS est posé par l'hébergeur à ce moment-là, pas à la
 * vérification. L'ancienne rédaction de ce commentaire laissait entendre
 * l'inverse, et l'écran du restaurateur le répétait.
 */

export type DomainVerification = {
  verified: boolean;
  /** Message destiné au restaurateur, expliquant l'état constaté. */
  detail: string;
};

/** Nom de l'enregistrement TXT que le restaurateur doit créer. */
export function verificationRecordName(hostname: string): string {
  return `_magyapro-verify.${hostname}`;
}

/** Cible CNAME vers laquelle le domaine doit pointer. */
export function cnameTarget(): string {
  return rootHostname();
}

export async function verifyDomain(
  hostname: string,
  expectedToken: string,
): Promise<DomainVerification> {
  // En développement, la résolution DNS d'un domaine de test échouerait
  // toujours : la vérification est explicitement neutralisée, et le dit.
  if (!env.isProduction && hostname.endsWith('.test')) {
    return {
      verified: true,
      detail: 'Domaine de test : vérification DNS ignorée hors production.',
    };
  }

  let records: string[][];
  try {
    records = await resolveTxt(verificationRecordName(hostname));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return {
        verified: false,
        detail: `Aucun enregistrement TXT trouvé sur ${verificationRecordName(hostname)}. La propagation DNS peut prendre jusqu'à 24 heures.`,
      };
    }
    return {
      verified: false,
      detail: 'La vérification DNS a échoué. Réessayez dans quelques minutes.',
    };
  }

  // Un enregistrement TXT long est renvoyé découpé en plusieurs chaînes qu'il
  // faut recoller avant de comparer.
  const values = records.map((chunks) => chunks.join(''));

  if (values.includes(expectedToken)) {
    return { verified: true, detail: 'Domaine vérifié.' };
  }

  return {
    verified: false,
    detail: `L'enregistrement TXT trouvé ne correspond pas à la valeur attendue. Vérifiez que ${verificationRecordName(hostname)} contient exactement la valeur fournie.`,
  };
}
