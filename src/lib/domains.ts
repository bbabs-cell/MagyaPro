import { createHmac } from 'node:crypto';
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
 * l'hébergeur et non sur le restaurant. MagyaPro ne fait pas cette déclaration
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

/**
 * Valeur TXT attendue pour qu'un restaurant prouve qu'il possède un domaine.
 *
 * Elle était tirée au hasard à chaque ajout, et un domaine en attente
 * bloquait l'adresse pour tous les autres restaurants : il suffisait de
 * revendiquer le domaine d'un autre — sans pouvoir le vérifier — pour
 * empêcher son vrai propriétaire de l'ajouter.
 *
 * Elle est désormais **dérivée** du restaurant et du domaine (HMAC avec le
 * secret du serveur) : toujours la même pour le même couple, impossible à
 * calculer pour un tiers. Une revendication en attente peut alors être
 * reprise par un autre restaurant (voir `/api/domaines`) sans rien coûter au
 * vrai propriétaire : il ajoute de nouveau son domaine, retrouve la même
 * valeur, et l'enregistrement qu'il avait déjà créé le vérifie aussitôt. Seul
 * un domaine vérifié reste attaché à son restaurant.
 */
export function domainVerificationToken(restaurantId: string, hostname: string): string {
  const digest = createHmac('sha256', env.sessionSecret)
    .update(`domain-verification:${restaurantId}:${hostname}`)
    .digest('base64url');
  return `magyapro-verify-${digest.slice(0, 32)}`;
}

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
