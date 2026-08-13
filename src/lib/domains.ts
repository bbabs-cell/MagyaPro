import { resolveTxt } from 'node:dns/promises';

import { env, rootHostname } from '@/lib/env';

/**
 * Vérification des domaines personnalisés.
 *
 * La preuve de propriété repose sur un enregistrement TXT : seul quelqu'un qui
 * contrôle la zone DNS du domaine peut le créer. Une simple requête HTTP vers
 * le domaine ne prouverait rien — n'importe qui peut faire pointer un CNAME.
 *
 * Le certificat TLS est délivré par la plateforme d'hébergement une fois le
 * domaine vérifié et le DNS propagé ; Magya n'émet pas de certificat lui-même.
 */

export type DomainVerification = {
  verified: boolean;
  /** Message destiné au restaurateur, expliquant l'état constaté. */
  detail: string;
};

/** Nom de l'enregistrement TXT que le restaurateur doit créer. */
export function verificationRecordName(hostname: string): string {
  return `_magya-verify.${hostname}`;
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
