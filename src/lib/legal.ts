import { RETENTION_DAYS } from '@/lib/retention';

/**
 * Faits communs aux trois pages légales.
 *
 * Mentions légales, conditions d'utilisation et politique de confidentialité
 * répètent nécessairement les mêmes éléments : le nom de l'éditeur, l'adresse
 * de contact, l'hébergeur. Recopiés dans trois fichiers, ils divergent — et
 * c'est exactement ce qui s'était produit : la politique de confidentialité
 * donnait une adresse de contact que les mentions légales déclaraient encore
 * « à compléter », et les conditions ne parlaient que de restaurants alors que
 * la moitié du produit sert des boutiques.
 *
 * Une divergence entre deux pages légales n'est pas une coquille : ce sont
 * deux engagements contradictoires pris envers la même personne.
 *
 * ## Ce qui est écrit ici est vérifiable
 *
 * Aucune information d'état civil de l'entreprise n'est inventée. Ce module ne
 * contient que des faits constatables dans le produit lui-même — l'hébergeur
 * qui sert les pages, les services tiers réellement appelés, les durées de
 * purge réellement appliquées. Ce qui manque manque explicitement, via
 * `PENDING`, plutôt que d'être comblé par une valeur plausible.
 */

/**
 * Marque‑page de ce qui reste à fournir.
 *
 * Une page légale incomplète est un fait, pas une faute : elle ne peut être
 * complétée qu'avec l'état civil de l'entreprise. L'afficher entre crochets
 * est préférable à une raison sociale inventée, qui serait une fausse
 * déclaration.
 */
export function pending(label: string): string {
  return `[${label} — à compléter]`;
}

/**
 * Nom du produit, dans la graphie réellement servie au visiteur — celle du
 * titre de page et du logo.
 *
 * À noter : `DESIGN.md` écrit « MagyaPro », avec un P majuscule, tandis que le
 * produit écrit « Magyapro » dans quarante-cinq fichiers, y compris le titre
 * de l'onglet et le texte alternatif du logo. Les pages légales suivent ce que
 * l'écran affiche : une mention légale qui nommerait l'éditeur autrement que
 * l'en-tête au-dessus d'elle serait la première incohérence que l'on
 * remarquerait. Trancher entre les deux graphies appartient au propriétaire de
 * la marque ; le jour où c'est fait, cette constante est le seul endroit à
 * changer pour ces trois pages.
 */
export const BRAND = 'Magyapro';

/**
 * Adresse de contact.
 *
 * Déjà publiée sur la politique de confidentialité avant ce regroupement ;
 * elle est reprise telle quelle et sert désormais aux trois pages. À
 * confirmer par le propriétaire : une adresse de contact qui ne relève pas
 * vaut moins que pas d'adresse du tout.
 */
export const CONTACT_EMAIL = 'contact@magyapro.com';

/**
 * Sous-traitants réellement sollicités par le produit, vérifiés dans le code.
 *
 * Cette liste n'est pas décorative : une politique de confidentialité qui tait
 * un destinataire des données ne remplit pas son office. Toute intégration
 * ajoutée plus tard doit apparaître ici.
 */
export const PROCESSORS = [
  { name: 'Vercel', role: 'hébergement de l’application et des pages' },
  { name: 'Cloudflare R2', role: 'stockage des images et fichiers téléversés' },
  { name: 'Cloudflare Turnstile', role: 'vérification anti-robot des formulaires' },
  { name: 'Africa’s Talking', role: 'envoi des SMS de suivi de commande' },
  { name: 'Sentry', role: 'signalement technique des erreurs de l’application' },
  { name: 'Google Analytics', role: 'mesure d’audience — après consentement seulement' },
  { name: 'Meta', role: 'mesure des campagnes — après consentement seulement' },
] as const;

/**
 * Durées de conservation, lues dans le module qui les applique réellement.
 *
 * Les annoncer à la main, c'est promettre un délai qu'aucun code ne tient. Ici
 * la page et la purge lisent la même constante : si l'une change, l'autre suit.
 */
export const RETENTION_STATEMENTS = [
  { what: 'Journal des actions de l’équipe', days: RETENTION_DAYS.auditLog },
  { what: 'Notification lue', days: RETENTION_DAYS.readNotification },
  { what: 'Notification jamais ouverte', days: RETENTION_DAYS.unreadNotification },
  { what: 'Annonce de la plateforme', days: RETENTION_DAYS.platformNotification },
] as const;

/** « 730 jours » ne se lit pas ; « 2 ans » si. */
export function humanDuration(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 an' : `${years} ans`;
  }
  if (days === 730) return '2 ans';
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? '1 mois' : `${months} mois`;
  }
  return `${days} jours`;
}
