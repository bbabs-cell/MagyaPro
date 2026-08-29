import { env } from '@/lib/env';

/**
 * État de configuration de l'envoi d'emails.
 *
 * Ne renvoie jamais la moindre valeur secrète : uniquement le nom du pilote et
 * la présence ou l'absence des réglages qu'il exige. Cet écart entre « une clé
 * est définie » et « voici la clé » est la seule raison d'être de ce module —
 * il permet d'afficher un diagnostic sans jamais exposer un identifiant.
 *
 * Pourquoi ce fichier existe : le pilote par défaut est `console`, qui écrit
 * l'email dans les journaux du serveur au lieu de l'envoyer. C'est le bon
 * comportement en développement, et une panne silencieuse en production —
 * l'inscription semble réussir, mais personne ne reçoit rien. Rien dans
 * l'application ne le signalait.
 */
export type MailStatus = {
  driver: string;
  /** `false` = les emails ne partent pas réellement, ou le pilote est mal réglé. */
  delivers: boolean;
  /** Explication en clair, destinée au Super Admin. */
  message: string;
  /** Réglages attendus par ce pilote, et leur présence. */
  settings: Array<{ key: string; present: boolean }>;
};

export function mailStatus(): MailStatus {
  const driver = env.mailDriver;

  if (driver === 'resend') {
    const present = Boolean(env.resendApiKey);
    return {
      driver,
      delivers: present,
      message: present
        ? 'Les emails partent via l’API Resend.'
        : 'Pilote Resend sélectionné, mais RESEND_API_KEY est absent : aucun email ne peut partir.',
      settings: [{ key: 'RESEND_API_KEY', present }],
    };
  }

  if (driver === 'smtp') {
    const settings = [
      { key: 'SMTP_HOST', present: Boolean(env.smtpHost) },
      { key: 'SMTP_USER', present: Boolean(env.smtpUser) },
      { key: 'SMTP_PASSWORD', present: Boolean(env.smtpPassword) },
    ];
    const complete = settings.every((setting) => setting.present);
    return {
      driver,
      delivers: complete,
      message: complete
        ? 'Les emails partent via le serveur SMTP configuré.'
        : 'Pilote SMTP sélectionné, mais des réglages manquent : aucun email ne peut partir.',
      settings,
    };
  }

  if (driver === 'console') {
    return {
      driver,
      delivers: false,
      message:
        'Aucun email n’est envoyé : ils sont seulement écrits dans les journaux du serveur. ' +
        'Convient au développement, jamais à la production — une inscription semble réussir, ' +
        'mais le client ne reçoit ni sa vérification d’adresse ni son lien de mot de passe oublié.',
      settings: [{ key: 'MAIL_DRIVER', present: true }],
    };
  }

  // Pilote inconnu : `mailer()` retombe silencieusement sur `console`.
  return {
    driver,
    delivers: false,
    message: `Pilote « ${driver} » inconnu. L’application retombe sur « console » : aucun email ne part.`,
    settings: [{ key: 'MAIL_DRIVER', present: true }],
  };
}
